import { existsSync } from "node:fs";
import path from "node:path";
import type { CourseConfig, CourseSource } from "./types.ts";
import { COURSE_CONFIG_DIR, CHAPTERS_DIR_NAME, DEFAULT_RETAIN_PATHS } from "./types.ts";
import { normalizeRetainPattern, normalizeSourceDirPath } from "./sourcePath.ts";

/** Sparse `course.jsonc` fields before load-time defaults. */
export interface ParsedCourseFields {
  id: string;
  title: string;
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
 * Applies course.jsonc defaults after parse.
 *
 * - `id` ← course home folder (or `{repo}-learn` at a git root); for `.learn/course`, learning folder name
 * - `title` ← `id`
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
  const repository = partial.source.repository.trim() || ".";
  const root = partial.source.root?.trim();
  const chaptersRaw = partial.chaptersDir.trim();
  const chaptersDir =
    chaptersRaw === "" ? CHAPTERS_DIR_NAME : (normalizeSourceDirPath(chaptersRaw) ?? chaptersRaw);
  return {
    id,
    title,
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
