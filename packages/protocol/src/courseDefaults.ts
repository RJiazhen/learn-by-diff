import { existsSync } from "node:fs";
import path from "node:path";
import type { CourseConfig, CourseDescription, CourseSource } from "./types.ts";
import { COURSE_CONFIG_DIR, CHAPTERS_DIR_NAME, DEFAULT_RETAIN_PATHS } from "./types.ts";
import { normalizeRetainPattern, normalizeSourceDirPath } from "./sourcePath.ts";

/** Sparse `course.jsonc` fields before load-time defaults. */
export interface ParsedCourseFields {
  id: string;
  title: string;
  /** Omitted when the JSONC field is empty. */
  description?: CourseDescription;
  source: CourseSource;
  /** Empty when omitted in JSONC; {@link applyCourseDefaults} fills `chapters`. */
  chaptersDir: string;
  /**
   * Author `retain` paths before defaults.
   * `undefined` means the field was omitted; `[]` is an explicit empty list.
   */
  retain?: string[];
}

/**
 * Returns the course home directory for a config dir.
 *
 * `.course-config` → its parent; `.learn/course` → learning workspace root;
 * otherwise the config dir itself (root-level `course.jsonc`).
 *
 * @param configDir - Absolute path to the directory that contains `course.jsonc`
 */
export function courseHomeDir(configDir: string): string {
  const base = path.basename(configDir);
  const parent = path.dirname(configDir);
  if (base === COURSE_CONFIG_DIR) {
    return parent;
  }
  if (base === "course" && path.basename(parent) === ".learn") {
    return path.dirname(parent);
  }
  return configDir;
}

/**
 * Derives a default course id from where the config directory sits.
 *
 * Uses the course home folder name. When that home is a git repository root and the
 * config is `.course-config` or a root-level `course.jsonc`, returns `{repoName}-learn`.
 *
 * @param configDir - Absolute path to the directory that contains `course.jsonc`
 */
export function defaultCourseId(configDir: string): string {
  const home = courseHomeDir(configDir);
  const name = path.basename(home).trim() || "course";
  if (isGitRepositoryRoot(home) && isCourseRootConfig(configDir, home)) {
    return `${name}-learn`;
  }
  return name;
}

/**
 * Trims a course description and drops blank locale entries.
 *
 * A string stays a string. An object keeps only non-empty tags and text.
 * An empty string, an empty object, or a non-description value becomes `undefined`.
 *
 * @param value - Raw `description` from JSONC or a parsed field
 */
export function normalizeCourseDescription(value: unknown): CourseDescription | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const descriptions: Record<string, string> = {};
  for (const [key, text] of Object.entries(value)) {
    if (typeof text !== "string") {
      continue;
    }
    const tag = key.trim();
    const trimmed = text.trim();
    if (tag === "" || trimmed === "") {
      continue;
    }
    descriptions[tag] = trimmed;
  }
  return Object.keys(descriptions).length === 0 ? undefined : descriptions;
}

/**
 * Chooses one description string for `locale`.
 *
 * A language-neutral string is used for every locale. A map matches the full
 * tag, then its primary language, then `en`, then the first remaining text.
 *
 * @param description - Parsed course description
 * @param locale - Page or editor language, such as `zh-CN`
 */
export function pickCourseDescription(
  description: CourseDescription | undefined,
  locale: string,
): string {
  if (description === undefined) {
    return "";
  }
  if (typeof description === "string") {
    return description;
  }
  const wanted = locale.trim();
  const exact = findDescriptionTag(description, wanted);
  if (exact !== undefined) {
    return exact;
  }
  const primary = wanted.split("-")[0] ?? "";
  if (primary !== "" && primary.toLowerCase() !== wanted.toLowerCase()) {
    const byLanguage = findDescriptionTag(description, primary);
    if (byLanguage !== undefined) {
      return byLanguage;
    }
    for (const [key, text] of Object.entries(description)) {
      if (key.split("-")[0]?.toLowerCase() === primary.toLowerCase()) {
        return text;
      }
    }
  }
  const english = findDescriptionTag(description, "en");
  if (english !== undefined) {
    return english;
  }
  const first = Object.values(description)[0];
  return first ?? "";
}

/**
 * Returns the text whose tag matches `wanted`, ignoring case.
 *
 * @param descriptions - Locale tag to text
 * @param wanted - Tag to find
 */
function findDescriptionTag(
  descriptions: Readonly<Record<string, string>>,
  wanted: string,
): string | undefined {
  const needle = wanted.toLowerCase();
  if (needle === "") {
    return undefined;
  }
  for (const [key, text] of Object.entries(descriptions)) {
    if (key.toLowerCase() === needle) {
      return text;
    }
  }
  return undefined;
}

/**
 * Applies course.jsonc defaults after parse.
 *
 * - `id` ← course home folder (or `{repo}-learn` at a git root); for `.learn/course`, learning folder name
 * - `title` ← `id`
 * - `description` ← omitted when empty; a string is one language, an object maps language tags to text
 * - `source.repository` ← `.` (directory that contains `course.jsonc`)
 * - `chaptersDir` ← `chapters` (directory next to `course.jsonc`)
 * - `retain` ← `node_modules` when omitted; an explicit array is kept (including `[]`)
 *
 * @param partial - Parsed fields (empty strings mean omitted)
 * @param configDir - Absolute config directory used for path-based defaults
 */
export function applyCourseDefaults(partial: ParsedCourseFields, configDir: string): CourseConfig {
  const id = partial.id.trim() || defaultCourseId(configDir);
  const title = partial.title.trim() || id;
  const description = normalizeCourseDescription(partial.description);
  const repository = partial.source.repository.trim() || ".";
  const root = partial.source.root?.trim();
  const chaptersRaw = partial.chaptersDir.trim();
  const chaptersDir =
    chaptersRaw === "" ? CHAPTERS_DIR_NAME : (normalizeSourceDirPath(chaptersRaw) ?? chaptersRaw);
  return {
    id,
    title,
    ...(description !== undefined && description !== "" ? { description } : {}),
    source: {
      repository,
      ...(root !== undefined && root !== "" ? { root } : {}),
    },
    chaptersDir,
    retain: normalizeRetainPaths(partial.retain),
  };
}

/**
 * Fills omitted `retain` with {@link DEFAULT_RETAIN_PATHS} and normalizes listed patterns.
 *
 * Invalid patterns are left unchanged so {@link validateCourse} can report them.
 * An explicit empty array stays empty. Trailing slashes and wildcards are preserved
 * so gitignore matching stays intact.
 *
 * @param retain - Parsed `retain`, or `undefined` when the field was omitted
 */
function normalizeRetainPaths(retain: string[] | undefined): string[] {
  if (retain === undefined) {
    return [...DEFAULT_RETAIN_PATHS];
  }
  return retain.map((entry) => normalizeRetainPattern(entry) ?? entry);
}

/**
 * Returns whether `configDir` is the course-root layout (`.course-config` or home-level `course.jsonc`).
 *
 * `.learn/course` is not a course-root layout.
 *
 * @param configDir - Directory that contains `course.jsonc`
 * @param home - {@link courseHomeDir} for `configDir`
 */
function isCourseRootConfig(configDir: string, home: string): boolean {
  if (path.basename(configDir) === COURSE_CONFIG_DIR) {
    return true;
  }
  return path.resolve(configDir) === path.resolve(home);
}

/**
 * Returns whether `dir` looks like a git repository root (has a `.git` entry).
 */
function isGitRepositoryRoot(dir: string): boolean {
  return existsSync(path.join(dir, ".git"));
}
