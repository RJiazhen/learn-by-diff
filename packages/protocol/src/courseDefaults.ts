import { existsSync } from "node:fs";
import path from "node:path";
import type { CourseConfig, CourseSource } from "./types.ts";
import { COURSE_CONFIG_DIR, CHAPTERS_DIR_NAME } from "./types.ts";
import { normalizeSourceDirPath } from "./sourcePath.ts";

/** Sparse `course.yml` fields before load-time defaults. */
export interface ParsedCourseFields {
  id: string;
  title: string;
  source: CourseSource;
  /** Empty when omitted in YAML; {@link applyCourseDefaults} fills `chapters`. */
  chaptersDir: string;
}

/**
 * Returns the course home directory for a config dir.
 *
 * `.course-config` → its parent; `.learn/course` → learning workspace root;
 * otherwise the config dir itself (root-level `course.yml`).
 *
 * @param configDir - Absolute path to the directory that contains `course.yml`
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
 * config is `.course-config` or a root-level `course.yml`, returns `{repoName}-learn`.
 *
 * @param configDir - Absolute path to the directory that contains `course.yml`
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
 * Applies course.yml defaults after parse.
 *
 * - `id` ← course home folder (or `{repo}-learn` at a git root); for `.learn/course`, learning folder name
 * - `title` ← `id`
 * - `source.repository` ← `.` (course home)
 * - `chaptersDir` ← `chapters` (directory next to `course.yml`)
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
  };
}

/**
 * Returns whether `configDir` is the course-root layout (`.course-config` or home-level `course.yml`).
 *
 * `.learn/course` is not a course-root layout.
 *
 * @param configDir - Directory that contains `course.yml`
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
