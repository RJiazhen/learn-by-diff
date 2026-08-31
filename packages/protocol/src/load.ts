import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { applyCourseDefaults } from "./courseDefaults.ts";
import { parseChapterYaml, parseCourseYaml } from "./parse.ts";
import type { ChapterConfig, Course } from "./types.ts";
import { CHAPTERS_DIR_NAME, COURSE_CONFIG_DIR, COURSE_FILE_NAME, ProtocolError } from "./types.ts";
import { validateCourse } from "./validate.ts";

const MISSING_COURSE_FILE_MESSAGE =
  "course config file was not found (looked in course.yml, then .course-config/course.yml)";

/**
 * Returns the directory that contains `course.yml` for `rootDir`.
 *
 * Prefers `{rootDir}/course.yml`, then `{rootDir}/.course-config/course.yml`.
 *
 * @param rootDir - Directory or repository root the user specified
 * @returns Config directory, or `undefined` when neither file exists
 */
export async function findCourseConfigDir(rootDir: string): Promise<string | undefined> {
  if (await isFile(path.join(rootDir, COURSE_FILE_NAME))) {
    return rootDir;
  }
  const nested = path.join(rootDir, COURSE_CONFIG_DIR);
  if (await isFile(path.join(nested, COURSE_FILE_NAME))) {
    return nested;
  }
  return undefined;
}

/**
 * Returns whether `rootDir` looks like a course repository.
 *
 * True when `{rootDir}/course.yml` or `{rootDir}/.course-config/course.yml` exists.
 *
 * @param rootDir - Repository root to inspect
 */
export async function isCourseRepository(rootDir: string): Promise<boolean> {
  return (await findCourseConfigDir(rootDir)) !== undefined;
}

/**
 * Loads and validates a course from a specified directory or repository root.
 *
 * @param rootDir - Directory that contains `course.yml` or `.course-config/course.yml`
 * @returns Validated course
 */
export async function loadCourse(rootDir: string): Promise<Course> {
  const configDir = await findCourseConfigDir(rootDir);
  if (configDir === undefined) {
    throw new ProtocolError([
      {
        path: COURSE_FILE_NAME,
        message: MISSING_COURSE_FILE_MESSAGE,
      },
    ]);
  }
  return loadCourseFromConfigDir(configDir);
}

/**
 * Loads and validates a course from a config directory (`course.yml` + `chapters/`).
 *
 * Used for a course-home `course.yml`, `.course-config/` in a course repo, and
 * `.learn/course/` in a learning repo.
 *
 * @param configDir - Directory that contains `course.yml`
 */
export async function loadCourseFromConfigDir(configDir: string): Promise<Course> {
  const filePath = path.join(configDir, COURSE_FILE_NAME);
  const courseRel = protocolPath(configDir, COURSE_FILE_NAME);
  let courseText: string;
  try {
    courseText = await readFile(filePath, "utf8");
  } catch {
    throw new ProtocolError([
      {
        path: courseRel,
        message: "course config file was not found",
      },
    ]);
  }

  const parsed = parseCourseYaml(courseText, courseRel);
  const config = applyCourseDefaults(parsed, configDir);
  const chapters = await loadChapters(configDir);
  return validateCourse(config, chapters, configDir);
}

/**
 * Reads chapter yaml files from `chapters/` under the config directory, sorted by file name.
 *
 * @param configDir - Directory that contains `course.yml`
 */
async function loadChapters(configDir: string): Promise<ChapterConfig[]> {
  const chaptersDir = path.join(configDir, CHAPTERS_DIR_NAME);
  let names: string[];
  try {
    names = await readdir(chaptersDir);
  } catch {
    throw new ProtocolError([
      {
        path: `${protocolPath(configDir, CHAPTERS_DIR_NAME)}/`,
        message: "chapters directory was not found",
      },
    ]);
  }

  const yamlNames = names
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .sort((left, right) => left.localeCompare(right));

  const chapters: ChapterConfig[] = [];
  for (const name of yamlNames) {
    const relativePath = protocolPath(configDir, CHAPTERS_DIR_NAME, name);
    const text = await readFile(path.join(chaptersDir, name), "utf8");
    chapters.push(parseChapterYaml(text, relativePath, name));
  }
  return chapters;
}

/**
 * Returns a protocol error path relative to the course home (POSIX slashes).
 *
 * Nested `.course-config` keeps that prefix; a root-level `course.yml` does not.
 *
 * @param configDir - Directory that contains `course.yml`
 * @param segments - Path segments under the config directory
 */
function protocolPath(configDir: string, ...segments: string[]): string {
  if (path.basename(configDir) === COURSE_CONFIG_DIR) {
    return [COURSE_CONFIG_DIR, ...segments].join("/");
  }
  return segments.join("/");
}

/**
 * Returns whether `filePath` exists and is a regular file.
 *
 * @param filePath - Absolute path
 */
async function isFile(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}
