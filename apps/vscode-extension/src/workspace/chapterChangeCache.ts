import type { ChapterConfig } from "@learn-by-diff/protocol";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import type { GitClient } from "../git/client.ts";
import type { ChangedEntryFile, EntryChangeKind } from "./entryChange.ts";
import { learningPaths } from "./paths.ts";

const CHANGE_KINDS: readonly EntryChangeKind[] = ["U", "M", "D"];

/** One chapter's persisted from/to compare result. */
export interface CachedChapterChange {
  fromDir: string;
  toDir: string;
  /** Chapter `entryFiles`, or `null` when omitted. */
  entryFiles: string[] | null;
  hasChanges: boolean;
  /** Full U/M/D list after expand, or `[]` when `hasChanges` is false. */
  files?: ChangedEntryFile[];
}

/** On-disk compare cache for one source revision. */
export interface ChapterChangeCacheFile {
  sourceRev: string;
  chapters: Record<string, CachedChapterChange>;
}

/**
 * Returns a cache identity key for the source store (git HEAD, or directory mtime).
 *
 * @param git - Git client
 * @param storePath - `.learn/source.git` (mirror or plain tree copy)
 */
export async function sourceStoreRevision(git: GitClient, storePath: string): Promise<string> {
  try {
    const result = await git.run(["--git-dir", storePath, "rev-parse", "HEAD"]);
    const sha = result.stdout.trim();
    if (sha !== "") {
      return sha;
    }
  } catch {
    // Plain tree copy, or a store that is not a git directory.
  }
  const info = await stat(storePath);
  return `mtime:${String(info.mtimeMs)}`;
}

/**
 * Returns whether a cache row still matches the chapter's from/to identity.
 *
 * @param chapter - Current chapter config
 * @param entry - Persisted row
 */
export function cacheEntryMatchesChapter(
  chapter: ChapterConfig,
  entry: CachedChapterChange,
): boolean {
  if (entry.fromDir !== chapter.fromDir || entry.toDir !== chapter.toDir) {
    return false;
  }
  return sameEntryFiles(chapter.entryFiles, entry.entryFiles);
}

/**
 * Reads `.learn/chapter-changes.json`, or `undefined` when missing or invalid.
 *
 * @param workspaceRoot - Learning workspace root
 */
export async function readChapterChangeCache(
  workspaceRoot: string,
): Promise<ChapterChangeCacheFile | undefined> {
  try {
    const text = await readFile(learningPaths(workspaceRoot).chapterChangesFile, "utf8");
    const parsed: unknown = JSON.parse(text);
    return isChapterChangeCacheFile(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Writes `.learn/chapter-changes.json`, creating `.learn` if needed.
 *
 * @param workspaceRoot - Learning workspace root
 * @param cache - Cache document
 */
export async function writeChapterChangeCache(
  workspaceRoot: string,
  cache: ChapterChangeCacheFile,
): Promise<void> {
  const { learnDir, chapterChangesFile } = learningPaths(workspaceRoot);
  await mkdir(learnDir, { recursive: true });
  await writeFile(chapterChangesFile, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

/**
 * Inserts or replaces one chapter row on `cache`.
 *
 * @param cache - In-memory cache document
 * @param chapter - Chapter whose identity is stored
 * @param result - Compare result to persist
 */
export function upsertCachedChapterChange(
  cache: ChapterChangeCacheFile,
  chapter: ChapterConfig,
  result: { hasChanges: boolean; files?: ChangedEntryFile[] },
): void {
  cache.chapters[chapter.id] = {
    fromDir: chapter.fromDir,
    toDir: chapter.toDir,
    entryFiles: chapter.entryFiles === undefined ? null : [...chapter.entryFiles],
    hasChanges: result.hasChanges,
    ...(result.files !== undefined ? { files: result.files } : {}),
  };
}

/**
 * Returns whether two `entryFiles` values are the same list (order-sensitive).
 *
 * @param declared - Chapter `entryFiles`
 * @param cached - Persisted list, or `null` when omitted
 */
function sameEntryFiles(declared: string[] | undefined, cached: string[] | null): boolean {
  if (declared === undefined) {
    return cached === null;
  }
  if (cached === null || declared.length !== cached.length) {
    return false;
  }
  return declared.every((path, index) => path === cached[index]);
}

/**
 * Type guard for {@link ChapterChangeCacheFile}.
 *
 * @param value - Parsed JSON
 */
function isChapterChangeCacheFile(value: unknown): value is ChapterChangeCacheFile {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.sourceRev !== "string" || record.sourceRev.trim() === "") {
    return false;
  }
  if (typeof record.chapters !== "object" || record.chapters === null) {
    return false;
  }
  for (const entry of Object.values(record.chapters)) {
    if (!isCachedChapterChange(entry)) {
      return false;
    }
  }
  return true;
}

/**
 * Type guard for {@link CachedChapterChange}.
 *
 * @param value - One chapters map value
 */
function isCachedChapterChange(value: unknown): value is CachedChapterChange {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.fromDir !== "string" || typeof record.toDir !== "string") {
    return false;
  }
  if (typeof record.hasChanges !== "boolean") {
    return false;
  }
  if (record.entryFiles !== null && !isStringArray(record.entryFiles)) {
    return false;
  }
  if (record.files !== undefined && !isChangedEntryFileList(record.files)) {
    return false;
  }
  return true;
}

/**
 * Returns whether `value` is a string array.
 *
 * @param value - Parsed JSON
 */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/**
 * Returns whether `value` is a persisted U/M/D file list.
 *
 * @param value - Parsed JSON
 */
function isChangedEntryFileList(value: unknown): value is ChangedEntryFile[] {
  if (!Array.isArray(value)) {
    return false;
  }
  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      return false;
    }
    const record = item as Record<string, unknown>;
    if (typeof record.relativePath !== "string") {
      return false;
    }
    if (!CHANGE_KINDS.includes(record.changeKind as EntryChangeKind)) {
      return false;
    }
  }
  return true;
}
