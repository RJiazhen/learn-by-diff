import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parseChapterYaml, parseCourseYaml } from "./parse.ts";
import type { ChapterConfig, Course } from "./types.ts";
import { CHAPTERS_DIR_NAME, COURSE_CONFIG_DIR, COURSE_FILE_NAME, ProtocolError } from "./types.ts";
import { validateCourse } from "./validate.ts";

/**
 * Returns whether `rootDir` looks like a course repository (has `.course-config/course.yml`).
 *
 * @param rootDir - Repository root to inspect
 */
export async function isCourseRepository(rootDir: string): Promise<boolean> {
  try {
    const info = await stat(courseFilePath(rootDir));
    return info.isFile();
  } catch {
    return false;
  }
}

/**
 * Loads and validates a course from a repository root that contains `.course-config`.
 *
 * @param rootDir - Course repository root
 * @returns Validated course
 */
export async function loadCourse(rootDir: string): Promise<Course> {
  return loadCourseFromConfigDir(path.join(rootDir, COURSE_CONFIG_DIR));
}

/**
 * Loads and validates a course from a config directory (`course.yml` + `chapters/`).
 *
 * Used for both `.course-config/` in a course repo and `.learn/course/` in a learning repo.
 *
 * @param configDir - Directory that contains `course.yml`
 */
export async function loadCourseFromConfigDir(configDir: string): Promise<Course> {
  const filePath = path.join(configDir, COURSE_FILE_NAME);
  let courseText: string;
  try {
    courseText = await readFile(filePath, "utf8");
  } catch {
    throw new ProtocolError([
      {
        path: `${COURSE_CONFIG_DIR}/${COURSE_FILE_NAME}`,
        message: "course config file was not found",
      },
    ]);
  }

  const config = parseCourseYaml(courseText, `${COURSE_CONFIG_DIR}/${COURSE_FILE_NAME}`);
  const chapters = await loadChapters(configDir);
  return validateCourse(config, chapters, configDir);
}

/**
 * Reads chapter yaml files from `.course-config/chapters`, sorted by file name.
 *
 * @param configDir - Absolute `.course-config` directory
 */
async function loadChapters(configDir: string): Promise<ChapterConfig[]> {
  const chaptersDir = path.join(configDir, CHAPTERS_DIR_NAME);
  let names: string[];
  try {
    names = await readdir(chaptersDir);
  } catch {
    throw new ProtocolError([
      {
        path: `${COURSE_CONFIG_DIR}/${CHAPTERS_DIR_NAME}/`,
        message: "chapters directory was not found",
      },
    ]);
  }

  const yamlNames = names
    .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"))
    .sort((left, right) => left.localeCompare(right));

  const chapters: ChapterConfig[] = [];
  for (const name of yamlNames) {
    const relativePath = `${COURSE_CONFIG_DIR}/${CHAPTERS_DIR_NAME}/${name}`;
    const text = await readFile(path.join(chaptersDir, name), "utf8");
    chapters.push(parseChapterYaml(text, relativePath));
  }
  return chapters;
}

/**
 * Returns the absolute path of `course.yml` under a repository root.
 */
function courseFilePath(rootDir: string): string {
  return path.join(rootDir, COURSE_CONFIG_DIR, COURSE_FILE_NAME);
}
