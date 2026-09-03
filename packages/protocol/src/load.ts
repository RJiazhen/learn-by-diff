import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { applyCourseDefaults } from "./courseDefaults.ts";
import { parseChapterYaml, parseCourseYaml } from "./parse.ts";
import type { ChapterConfig, Course } from "./types.ts";
import { COURSE_CONFIG_DIR, COURSE_FILE_NAME, ProtocolError } from "./types.ts";
import { validateCourse } from "./validate.ts";

const MISSING_COURSE_FILE_MESSAGE =
  "course config file was not found (looked in course.yml, then .course-config/course.yml)";

/**
 * Returns the directory that contains `course.yml` for `rootDir`.
 *
 * Prefers `{rootDir}/course.yml`, then `{rootDir}/.course-config/course.yml`.
 * Used when cloning a remote course repository (the user did not pick a file).
 *
 * @param rootDir - Directory or repository root to inspect
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
 * Loads and validates a course from a `course.yml` file or a directory/repo root.
 *
 * A file must be named `course.yml`. A directory still looks up `course.yml` then
 * `.course-config/course.yml` (cloned remotes and fixtures).
 *
 * @param target - Absolute or relative path to `course.yml` or a course root
 * @returns Validated course
 */
export async function loadCourse(target: string): Promise<Course> {
  let info: Awaited<ReturnType<typeof stat>>;
  try {
    info = await stat(target);
  } catch {
    throw new ProtocolError([
      {
        path: COURSE_FILE_NAME,
        message: MISSING_COURSE_FILE_MESSAGE,
      },
    ]);
  }
  if (info.isFile()) {
    return loadCourseFromFile(target);
  }
  const configDir = await findCourseConfigDir(target);
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
 * Loads and validates a course from an explicit `course.yml` file path.
 *
 * @param filePath - Path that must exist and be named `course.yml`
 */
export async function loadCourseFromFile(filePath: string): Promise<Course> {
  const resolved = path.resolve(filePath);
  if (path.basename(resolved) !== COURSE_FILE_NAME) {
    throw new ProtocolError([
      {
        path: path.basename(resolved),
        message: `expected ${COURSE_FILE_NAME}`,
      },
    ]);
  }
  if (!(await isFile(resolved))) {
    throw new ProtocolError([
      {
        path: COURSE_FILE_NAME,
        message: "course config file was not found",
      },
    ]);
  }
  return loadCourseFromConfigDir(path.dirname(resolved));
}

/**
 * Loads and validates a course from a config directory (`course.yml` + chapters dir).
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
  const chapters = await loadChapters(configDir, config.chaptersDir);
  return validateCourse(config, chapters, configDir);
}

/**
 * Reads chapter yaml files from `chaptersDir` under the config directory, sorted by file name.
 *
 * @param configDir - Directory that contains `course.yml`
 * @param chaptersDir - Posix-relative chapters directory (already defaulted/validated shape)
 */
async function loadChapters(configDir: string, chaptersDir: string): Promise<ChapterConfig[]> {
  const chaptersAbs = joinConfigRelative(configDir, chaptersDir);
  let names: string[];
  try {
    names = await readdir(chaptersAbs);
  } catch {
    throw new ProtocolError([
      {
        path: `${protocolPath(configDir, chaptersDir)}/`,
        message: "chapters directory was not found",
      },
    ]);
  }

  const yamlNames = names
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .sort((left, right) => left.localeCompare(right));

  const chapters: ChapterConfig[] = [];
  for (const name of yamlNames) {
    const relativePath = protocolPath(configDir, `${chaptersDir}/${name}`);
    const text = await readFile(path.join(chaptersAbs, name), "utf8");
    chapters.push(parseChapterYaml(text, relativePath, name));
  }
  return chapters;
}

/**
 * Joins a posix-relative path onto a config directory as a filesystem path.
 *
 * @param configDir - Directory that contains `course.yml`
 * @param relativePosix - Slash-separated path under the config directory
 */
function joinConfigRelative(configDir: string, relativePosix: string): string {
  return path.join(configDir, ...relativePosix.split("/").filter((segment) => segment !== ""));
}

/**
 * Returns a protocol error path relative to the course home (POSIX slashes).
 *
 * Nested `.course-config` keeps that prefix; a root-level `course.yml` does not.
 *
 * @param configDir - Directory that contains `course.yml`
 * @param relativePosix - Path under the config directory
 */
function protocolPath(configDir: string, relativePosix: string): string {
  if (path.basename(configDir) === COURSE_CONFIG_DIR) {
    return `${COURSE_CONFIG_DIR}/${relativePosix}`;
  }
  return relativePosix;
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
