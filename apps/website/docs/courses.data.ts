import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "jsonc-parser";

/** One course shown on every locale's course list. */
export interface CourseListItem {
  id: string;
  title: string;
  /** Short description from `course.jsonc`. Empty when the file omits it. */
  description: string;
  /** GitHub blob URL of that course's `course.jsonc`. */
  blobUrl: string;
  /** `vscode://` link that opens this course. */
  vscodeUrl: string;
  /** `cursor://` link that opens this course. */
  cursorUrl: string;
}

const coursesDir = fileURLToPath(new URL("../../../packages/courses-config/", import.meta.url));
const blobRoot = "https://github.com/RJiazhen/learn-by-diff/blob/main/packages/courses-config";

/**
 * Reads a JSONC file from disk.
 *
 * @param filePath - Absolute path
 */
function readJsonc(filePath: string): unknown {
  return parse(readFileSync(filePath, "utf8"));
}

/**
 * Returns whether `value` is a JSON object.
 *
 * @param value - Parsed JSONC value
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Returns a trimmed string, or `undefined` when `value` is empty.
 *
 * @param value - JSON field
 */
function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Returns the `course.jsonc` path inside `packages/courses-config` for a catalog row.
 *
 * A directory is `course.jsonc`, or `.course-config/course.jsonc` when that file exists.
 *
 * @param catalogPath - `path` from `courses.jsonc`
 */
function resolveCourseJsonc(catalogPath: string): string {
  if (catalogPath === "course.jsonc" || catalogPath.endsWith("/course.jsonc")) {
    return catalogPath;
  }
  const nested = path.join(coursesDir, catalogPath, ".course-config", "course.jsonc");
  if (existsSync(nested)) {
    return `${catalogPath}/.course-config/course.jsonc`;
  }
  return `${catalogPath}/course.jsonc`;
}

/**
 * Builds a GitHub blob URL for a file inside `packages/courses-config`.
 *
 * @param relPath - Path relative to that directory
 */
function courseBlobUrl(relPath: string): string {
  const encoded = relPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${blobRoot}/${encoded}`;
}

/**
 * Builds a LearnByDiff deep link that opens `blobUrl` in an editor.
 *
 * @param scheme - `vscode` or `cursor`
 * @param blobUrl - GitHub blob URL of `course.jsonc`
 */
function openCourseLink(scheme: "vscode" | "cursor", blobUrl: string): string {
  return `${scheme}://RuanJiazhen.learn-by-diff/open?url=${encodeURIComponent(blobUrl)}`;
}

/**
 * Builds one list row from a catalog entry and its `course.jsonc` title.
 *
 * @param row - One element of `courses`
 */
function courseListItem(row: unknown): CourseListItem | undefined {
  if (!isRecord(row)) {
    return undefined;
  }
  const catalogPath = asNonEmptyString(row.path);
  if (catalogPath === undefined) {
    return undefined;
  }
  const relPath = resolveCourseJsonc(catalogPath);
  const filePath = path.join(coursesDir, relPath);
  let fileId = "";
  let fileTitle = "";
  let description = "";
  if (existsSync(filePath)) {
    const course = readJsonc(filePath);
    if (isRecord(course)) {
      fileId = asNonEmptyString(course.id) ?? "";
      fileTitle = asNonEmptyString(course.title) ?? "";
      description = asNonEmptyString(course.description) ?? "";
    }
  }
  const id = fileId || asNonEmptyString(row.id) || catalogPath;
  const title = fileTitle || asNonEmptyString(row.title) || id;
  const blobUrl = courseBlobUrl(relPath);
  return {
    id,
    title,
    description,
    blobUrl,
    vscodeUrl: openCourseLink("vscode", blobUrl),
    cursorUrl: openCourseLink("cursor", blobUrl),
  };
}

/**
 * Loads every course recorded in `packages/courses-config/courses.jsonc`.
 */
function loadCourses(): CourseListItem[] {
  const catalog = readJsonc(path.join(coursesDir, "courses.jsonc"));
  if (!isRecord(catalog) || !Array.isArray(catalog.courses)) {
    return [];
  }
  const items: CourseListItem[] = [];
  for (const row of catalog.courses) {
    const item = courseListItem(row);
    if (item !== undefined) {
      items.push(item);
    }
  }
  return items;
}

export default {
  watch: ["../../../packages/courses-config/**/*.jsonc"],
  /**
   * Returns the course list rendered by each locale's course page.
   */
  load(): CourseListItem[] {
    return loadCourses();
  },
};
