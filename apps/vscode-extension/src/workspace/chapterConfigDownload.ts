import { CHAPTERS_DIR_NAME, COURSE_FILE_NAME, parseCourseJsonc } from "@learn-by-diff/protocol";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseCourseConfigUrl } from "./parseCourseConfigUrl.ts";
import { learningPaths } from "./paths.ts";

/**
 * Remembers that chapter JSONC files are not downloaded yet.
 *
 * `completed` stays `false` while the file exists. The file is deleted when the
 * download finishes, so a completed download leaves no record.
 */
export interface ChapterConfigDownloadRecord {
  completed: false;
  owner: string;
  repo: string;
  ref: string;
  /** Posix directory of chapter JSONC inside the GitHub repository. */
  chaptersRelPath: string;
  /** Chapters directory relative to the directory that contains `course.jsonc`. */
  chaptersDir: string;
}

/**
 * Builds the pending chapter-config record for a GitHub `course.jsonc` URL.
 *
 * Returns `undefined` when `courseRepoUrl` is not a GitHub file URL. Chapter
 * files themselves are not downloaded.
 *
 * @param courseRepoUrl - Open Course input that points at `course.jsonc`
 * @param courseJsoncText - Raw `course.jsonc` already downloaded
 */
export function chapterConfigDownloadRecordFromCourse(
  courseRepoUrl: string,
  courseJsoncText: string,
): ChapterConfigDownloadRecord | undefined {
  const remote = parseCourseConfigUrl(courseRepoUrl);
  if (remote?.kind !== "githubFile") {
    return undefined;
  }
  const ownerRepo = githubOwnerRepo(remote.cloneUrl);
  if (ownerRepo === undefined) {
    return undefined;
  }
  const parsed = parseCourseJsonc(courseJsoncText, COURSE_FILE_NAME);
  const chaptersDir = parsed.chaptersDir.trim() || CHAPTERS_DIR_NAME;
  const parent = remote.configRelPath.split("/").slice(0, -1).filter(Boolean).join("/");
  return {
    completed: false,
    owner: ownerRepo.owner,
    repo: ownerRepo.repo,
    ref: remote.ref,
    chaptersDir,
    chaptersRelPath: parent === "" ? chaptersDir : `${parent}/${chaptersDir}`,
  };
}

/**
 * Returns the raw.githubusercontent.com URL for a GitHub `course.jsonc` file URL.
 *
 * @param courseRepoUrl - Open Course input
 * @returns Raw file URL, or `undefined` when the input is not a GitHub `course.jsonc` link
 */
export function githubRawCourseJsoncUrl(courseRepoUrl: string): string | undefined {
  const remote = parseCourseConfigUrl(courseRepoUrl);
  if (remote?.kind !== "githubFile") {
    return undefined;
  }
  const ownerRepo = githubOwnerRepo(remote.cloneUrl);
  if (ownerRepo === undefined) {
    return undefined;
  }
  return `https://raw.githubusercontent.com/${ownerRepo.owner}/${ownerRepo.repo}/${encodeRepoPath(remote.ref)}/${encodeRepoPath(remote.configRelPath)}`;
}

/**
 * Reads `.learn/chapter-config-download.json`, or `undefined` when it is missing or invalid.
 *
 * @param workspaceRoot - Learning repository root
 */
export async function readChapterConfigDownloadRecord(
  workspaceRoot: string,
): Promise<ChapterConfigDownloadRecord | undefined> {
  try {
    const text = await readFile(learningPaths(workspaceRoot).chapterConfigDownloadFile, "utf8");
    return chapterConfigDownloadRecordFromJson(JSON.parse(text) as unknown);
  } catch {
    return undefined;
  }
}

/**
 * Writes the pending chapter-config record.
 *
 * @param workspaceRoot - Learning repository root
 * @param record - Not-yet-completed download
 */
export async function writeChapterConfigDownloadRecord(
  workspaceRoot: string,
  record: ChapterConfigDownloadRecord,
): Promise<void> {
  const { learnDir, chapterConfigDownloadFile } = learningPaths(workspaceRoot);
  await mkdir(learnDir, { recursive: true });
  await writeFile(chapterConfigDownloadFile, `${JSON.stringify(record, null, 2)}\n`, "utf8");
}

/**
 * Deletes the pending chapter-config record after the download finishes.
 *
 * @param workspaceRoot - Learning repository root
 */
export async function removeChapterConfigDownloadRecord(workspaceRoot: string): Promise<void> {
  await rm(learningPaths(workspaceRoot).chapterConfigDownloadFile, { force: true });
}

/**
 * Downloads chapter JSONC files described by `record` into `chaptersDir`.
 *
 * Does not update the pending record. The caller deletes that record after this resolves.
 *
 * @param record - Pending download
 * @param chaptersDir - Absolute directory that will hold the chapter JSONC files
 * @param fetchJson - Reads the GitHub contents listing
 * @param fetchText - Reads one raw chapter file
 */
export async function downloadChapterConfigFiles(
  record: ChapterConfigDownloadRecord,
  chaptersDir: string,
  fetchJson: (url: string) => Promise<unknown>,
  fetchText: (url: string) => Promise<string | undefined>,
): Promise<void> {
  const listing = await fetchJson(githubContentsUrl(record));
  if (!Array.isArray(listing)) {
    throw new Error(`chapter config directory is not a file list: ${record.chaptersRelPath}`);
  }
  await mkdir(chaptersDir, { recursive: true });
  for (const item of listing) {
    const name = githubContentFileName(item);
    if (name === undefined) {
      continue;
    }
    const text = await fetchText(githubRawChapterUrl(record, name));
    if (text === undefined) {
      throw new Error(`chapter config file was not downloaded: ${name}`);
    }
    await writeFile(path.join(chaptersDir, name), text, "utf8");
  }
}

/**
 * Returns the GitHub contents API URL for the recorded chapters directory.
 *
 * @param record - Pending download
 */
export function githubContentsUrl(record: ChapterConfigDownloadRecord): string {
  return `https://api.github.com/repos/${encodeURIComponent(record.owner)}/${encodeURIComponent(record.repo)}/contents/${encodeRepoPath(record.chaptersRelPath)}?ref=${encodeURIComponent(record.ref)}`;
}

/**
 * Returns a raw URL for one chapter JSONC file in the recorded directory.
 *
 * @param record - Pending download
 * @param fileName - Chapter JSONC basename
 */
export function githubRawChapterUrl(record: ChapterConfigDownloadRecord, fileName: string): string {
  return `https://raw.githubusercontent.com/${encodeURIComponent(record.owner)}/${encodeURIComponent(record.repo)}/${encodeRepoPath(record.ref)}/${encodeRepoPath(`${record.chaptersRelPath}/${fileName}`)}`;
}

/**
 * Returns owner and repo from `https://github.com/{owner}/{repo}.git`.
 *
 * @param cloneUrl - Clone URL from a GitHub file origin
 */
function githubOwnerRepo(cloneUrl: string): { owner: string; repo: string } | undefined {
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/i.exec(cloneUrl);
  if (match === null) {
    return undefined;
  }
  const owner = match[1];
  const repo = match[2];
  if (owner === undefined || repo === undefined || owner === "" || repo === "") {
    return undefined;
  }
  return { owner, repo };
}

/**
 * Percent-encodes each path segment without encoding slashes.
 *
 * @param relPath - Slash-separated path or git ref
 */
function encodeRepoPath(relPath: string): string {
  return relPath
    .split("/")
    .filter((segment) => segment !== "")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

/**
 * Returns a record when `value` has the fields a resume needs.
 *
 * @param value - Parsed JSON
 */
function chapterConfigDownloadRecordFromJson(
  value: unknown,
): ChapterConfigDownloadRecord | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (
    record.completed !== false ||
    typeof record.owner !== "string" ||
    typeof record.repo !== "string" ||
    typeof record.ref !== "string" ||
    typeof record.chaptersRelPath !== "string" ||
    typeof record.chaptersDir !== "string"
  ) {
    return undefined;
  }
  return {
    completed: false,
    owner: record.owner,
    repo: record.repo,
    ref: record.ref,
    chaptersRelPath: record.chaptersRelPath,
    chaptersDir: record.chaptersDir,
  };
}

/**
 * Returns a chapter JSONC basename from a GitHub contents entry, or `undefined` to skip it.
 *
 * @param item - One element of the contents API response
 */
function githubContentFileName(item: unknown): string | undefined {
  if (typeof item !== "object" || item === null) {
    return undefined;
  }
  const entry = item as Record<string, unknown>;
  if (entry.type !== "file" || typeof entry.name !== "string" || !entry.name.endsWith(".jsonc")) {
    return undefined;
  }
  return entry.name;
}
