import { parseCourseJsonc } from "@learn-by-diff/protocol";
import { parse, printParseErrorCode, type ParseError } from "jsonc-parser";

const OFFICIAL_COURSES_OWNER = "RJiazhen";
const OFFICIAL_COURSES_REPO = "learn-by-diff-courses";
const OFFICIAL_COURSES_REF = "main";
const COURSE_FILE_NAME = "course.jsonc";

/** Raw URL of the official course catalog on the default branch. */
export const OFFICIAL_COURSES_CATALOG_RAW_URL = `https://raw.githubusercontent.com/${OFFICIAL_COURSES_OWNER}/${OFFICIAL_COURSES_REPO}/${OFFICIAL_COURSES_REF}/courses.jsonc`;

/** One course recorded in the official `courses.jsonc` catalog. */
export interface OfficialCourseEntry {
  id: string;
  /** Catalog title; empty when the file omitted it. */
  title: string;
  /** Posix path inside the official course repository. */
  path: string;
}

/** A course the Open Course list can open after its `course.jsonc` was read. */
export interface OfficialCourseChoice {
  id: string;
  title: string;
  /** GitHub blob URL of that course's `course.jsonc`. */
  courseJsoncUrl: string;
  /** Raw `course.jsonc` when that file was downloaded. Chapter JSONC is not included. */
  courseJsoncText?: string;
}

/**
 * Reads one remote URL as text.
 *
 * Returns `undefined` when the file is missing. Cancellation must reject.
 */
export type RemoteTextFetcher = (url: string) => Promise<string | undefined>;

/** Thrown when the official `courses.jsonc` cannot be read or is not a catalog. */
export class OfficialCourseCatalogError extends Error {
  /**
   * Creates an error whose message is written to the LearnByDiff output channel.
   *
   * @param message - Why the catalog could not be used
   */
  constructor(message: string) {
    super(message);
    this.name = "OfficialCourseCatalogError";
  }
}

/**
 * Returns whether `error` is a cancelled fetch.
 *
 * @param error - Rejection from {@link fetchRemoteText}
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * Downloads `url` as text.
 *
 * Returns `undefined` for HTTP errors and network failures. Cancellation rejects
 * so Open Course can stop the list without treating that as a broken catalog.
 *
 * @param url - Absolute http(s) URL
 * @param signal - Aborts the request when the progress notification is cancelled
 */
export async function fetchRemoteText(
  url: string,
  signal?: AbortSignal,
): Promise<string | undefined> {
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      return undefined;
    }
    return await response.text();
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    return undefined;
  }
}

/**
 * Parses the official `courses.jsonc` catalog.
 *
 * Comments and trailing commas are allowed. Entries with a missing or unsafe
 * `path` are skipped. `id` defaults to the path's last directory name.
 *
 * @param text - Raw catalog JSONC
 * @throws OfficialCourseCatalogError when the document is not a catalog object
 */
export function parseOfficialCourseCatalog(text: string): OfficialCourseEntry[] {
  const errors: ParseError[] = [];
  const value: unknown = parse(text, errors, {
    allowTrailingComma: true,
    allowEmptyContent: true,
  });
  if (errors.length > 0) {
    const message = errors.map((error) => printParseErrorCode(error.error)).join("; ");
    throw new OfficialCourseCatalogError(`invalid courses.jsonc: ${message}`);
  }
  if (value === null || value === undefined) {
    return [];
  }
  if (!isRecord(value) || !Array.isArray(value.courses)) {
    throw new OfficialCourseCatalogError("courses.jsonc must contain a courses array");
  }
  const entries: OfficialCourseEntry[] = [];
  for (const item of value.courses) {
    const entry = catalogEntry(item);
    if (entry !== undefined) {
      entries.push(entry);
    }
  }
  return entries;
}

/**
 * Downloads the official catalog and each course's `course.jsonc`.
 *
 * Course order matches `courses.jsonc`. Only each course's `course.jsonc` is read;
 * chapter JSONC files are not downloaded here. A missing `course.jsonc` still produces
 * a choice from the catalog title so every recorded course stays selectable.
 *
 * @param fetchText - Remote text reader
 * @throws OfficialCourseCatalogError when the catalog itself cannot be read or parsed
 */
export async function loadOfficialCourses(
  fetchText: RemoteTextFetcher,
): Promise<OfficialCourseChoice[]> {
  const catalogText = await fetchText(OFFICIAL_COURSES_CATALOG_RAW_URL);
  if (catalogText === undefined) {
    throw new OfficialCourseCatalogError(`Could not read ${OFFICIAL_COURSES_CATALOG_RAW_URL}`);
  }
  const entries = parseOfficialCourseCatalog(catalogText);
  /**
   * Resolves one catalog row with the shared text fetcher.
   *
   * @param entry - Catalog row
   */
  function resolveEntry(entry: OfficialCourseEntry): Promise<OfficialCourseChoice | undefined> {
    return resolveOfficialCourse(entry, fetchText);
  }
  const choices = await Promise.all(entries.map(resolveEntry));
  return choices.filter(isOfficialCourseChoice);
}

/**
 * Keeps resolved courses and drops catalog rows that had no safe path.
 *
 * @param choice - Result of resolving one catalog row
 */
function isOfficialCourseChoice(
  choice: OfficialCourseChoice | undefined,
): choice is OfficialCourseChoice {
  return choice !== undefined;
}

/**
 * Reads one catalog entry's `course.jsonc` and builds an Open Course choice.
 *
 * Tries `course.jsonc` in the catalog directory, then `.course-config/course.jsonc`.
 * When every candidate is missing, the catalog title is kept and the first
 * candidate URL is still listed.
 *
 * @param entry - Row from `courses.jsonc`
 * @param fetchText - Remote text reader
 */
async function resolveOfficialCourse(
  entry: OfficialCourseEntry,
  fetchText: RemoteTextFetcher,
): Promise<OfficialCourseChoice | undefined> {
  const candidates = officialCourseJsoncPaths(entry.path);
  const first = candidates[0];
  if (first === undefined) {
    return undefined;
  }
  for (const relPath of candidates) {
    const text = await fetchText(officialRawFileUrl(relPath));
    if (text === undefined) {
      continue;
    }
    return choiceFromCourseJsonc(entry, relPath, text);
  }
  return {
    id: entry.id,
    title: entry.title || entry.id,
    courseJsoncUrl: officialBlobFileUrl(first),
  };
}

/**
 * Builds a picker choice from `course.jsonc` text, falling back to catalog fields.
 *
 * Invalid JSONC still lists the catalog title and opens that file URL.
 *
 * @param entry - Catalog row
 * @param relPath - Repo-relative `course.jsonc` that was downloaded
 * @param text - Raw `course.jsonc` contents
 */
function choiceFromCourseJsonc(
  entry: OfficialCourseEntry,
  relPath: string,
  text: string,
): OfficialCourseChoice {
  let fileId = "";
  let fileTitle = "";
  try {
    const parsed = parseCourseJsonc(text, relPath);
    fileId = parsed.id;
    fileTitle = parsed.title;
  } catch {
    // Catalog metadata still identifies the course; Open Course reports protocol errors later.
  }
  const id = fileId || entry.id;
  const title = fileTitle || entry.title || id;
  return {
    id,
    title,
    courseJsoncUrl: officialBlobFileUrl(relPath),
    courseJsoncText: text,
  };
}

/**
 * Returns repo-relative `course.jsonc` locations to try for a catalog path.
 *
 * A path that already names `course.jsonc` is used as-is. A directory is tried
 * at `course.jsonc`, then `.course-config/course.jsonc`.
 *
 * @param catalogPath - Normalized path from `courses.jsonc`
 */
function officialCourseJsoncPaths(catalogPath: string): string[] {
  if (catalogPath === COURSE_FILE_NAME || catalogPath.endsWith(`/${COURSE_FILE_NAME}`)) {
    return [catalogPath];
  }
  return [
    `${catalogPath}/${COURSE_FILE_NAME}`,
    `${catalogPath}/.course-config/${COURSE_FILE_NAME}`,
  ];
}

/**
 * Builds a raw.githubusercontent.com URL for a file in the official course repo.
 *
 * @param relPath - Normalized posix path
 */
function officialRawFileUrl(relPath: string): string {
  return `https://raw.githubusercontent.com/${OFFICIAL_COURSES_OWNER}/${OFFICIAL_COURSES_REPO}/${OFFICIAL_COURSES_REF}/${encodeRepoPath(relPath)}`;
}

/**
 * Builds the GitHub blob URL Open Course uses for a catalog `course.jsonc`.
 *
 * @param relPath - Normalized posix path
 */
function officialBlobFileUrl(relPath: string): string {
  return `https://github.com/${OFFICIAL_COURSES_OWNER}/${OFFICIAL_COURSES_REPO}/blob/${OFFICIAL_COURSES_REF}/${encodeRepoPath(relPath)}`;
}

/**
 * Percent-encodes each path segment without encoding slashes.
 *
 * @param relPath - Normalized posix path
 */
function encodeRepoPath(relPath: string): string {
  return relPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * Returns a catalog row when `item` has a safe repository-relative path.
 *
 * @param item - One element of `courses`
 */
function catalogEntry(item: unknown): OfficialCourseEntry | undefined {
  if (!isRecord(item)) {
    return undefined;
  }
  const relPath = normalizeRepoPath(typeof item.path === "string" ? item.path : "");
  if (relPath === undefined) {
    return undefined;
  }
  const id = asNonEmptyString(item.id) ?? idFromRepoPath(relPath);
  const title = asNonEmptyString(item.title) ?? "";
  return { id, title, path: relPath };
}

/**
 * Uses the last directory name of a catalog path as the course id.
 *
 * `chibivue-zh-cn/course.jsonc` becomes `chibivue-zh-cn`.
 *
 * @param relPath - Normalized posix path
 */
function idFromRepoPath(relPath: string): string {
  const segments = relPath.split("/");
  if (segments[segments.length - 1] === COURSE_FILE_NAME) {
    segments.pop();
  }
  if (segments[segments.length - 1] === ".course-config") {
    segments.pop();
  }
  return segments[segments.length - 1] ?? relPath;
}

/**
 * Returns a posix path inside the course repository, or `undefined` when unsafe.
 *
 * Rejects empty paths, absolute paths, URLs, and any `.` or `..` segment.
 *
 * @param value - Catalog `path`
 */
function normalizeRepoPath(value: string): string | undefined {
  const trimmed = value.trim().replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
  if (trimmed === "" || trimmed.includes("://")) {
    return undefined;
  }
  const segments = trimmed.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    return undefined;
  }
  return segments.join("/");
}

/**
 * Returns a trimmed string, or `undefined` when `value` is not non-empty text.
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
 * Returns whether `value` is a JSON object.
 *
 * @param value - Parsed JSONC value
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
