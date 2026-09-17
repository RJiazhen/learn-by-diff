import type { ChapterConfig, CourseSource } from "@learn-by-diff/protocol";
import { resolveSourceSubtreePath } from "@learn-by-diff/protocol";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { GitClient } from "../git/client.ts";
import {
  listDirectoryFiles,
  listSourceSubtreeFiles,
  readSourceFile,
  sourceFileExists,
} from "./sourceStore.ts";

/** SCM-style change letter for a chapter entry file. */
export type EntryChangeKind = "U" | "M" | "D";

/** One changed entry file under a chapter. */
export interface ChangedEntryFile {
  relativePath: string;
  changeKind: EntryChangeKind;
}

/**
 * Returns whether `absPath` exists as a file.
 *
 * @param absPath - Absolute filesystem path
 */
async function isFile(absPath: string): Promise<boolean> {
  try {
    return (await stat(absPath)).isFile();
  } catch {
    return false;
  }
}

/**
 * Joins a snapshot root with a chapter-relative file path.
 *
 * @param snapshotRoot - Cached from/to snapshot directory
 * @param relativePath - Path relative to the chapter tree root
 */
function snapshotRelativeFile(snapshotRoot: string, relativePath: string): string {
  return path.join(snapshotRoot, ...relativePath.split(/[/\\]/));
}

/**
 * Classifies how an entry file changes between two on-disk snapshot directories.
 *
 * @param fromRoot - Cached start snapshot directory
 * @param toRoot - Cached goal snapshot directory
 * @param relativePath - Path relative to the chapter tree root
 */
export async function classifySnapshotEntryChange(
  fromRoot: string,
  toRoot: string,
  relativePath: string,
): Promise<EntryChangeKind | undefined> {
  const normalizedRelative = relativePath.split(/[/\\]/).join("/");
  const fromPath = snapshotRelativeFile(fromRoot, normalizedRelative);
  const toPath = snapshotRelativeFile(toRoot, normalizedRelative);
  const fromExists = await isFile(fromPath);
  const toExists = await isFile(toPath);

  if (!fromExists && toExists) {
    return "U";
  }
  if (fromExists && !toExists) {
    return "D";
  }
  if (!fromExists && !toExists) {
    return undefined;
  }

  const fromText = await readFile(fromPath, "utf8");
  const toText = await readFile(toPath, "utf8");
  if (fromText === toText) {
    return undefined;
  }
  return "M";
}

/**
 * Returns whether a chapter's `fromDir` and `toDir` resolve to the same snapshot tree.
 *
 * Identical dirs cannot produce entry-file diffs, so the chapter is unchanged.
 *
 * @param source - Course source block (applies optional `root`)
 * @param chapter - Chapter whose snapshot dirs are compared
 */
export function chapterFromToShareSnapshot(source: CourseSource, chapter: ChapterConfig): boolean {
  return (
    resolveSourceSubtreePath(source, chapter.fromDir) ===
    resolveSourceSubtreePath(source, chapter.toDir)
  );
}

/**
 * Returns whether two path lists name the same set of relative files.
 *
 * @param left - First file list
 * @param right - Second file list
 */
function fileListsMatch(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const rightSet = new Set(right);
  for (const item of left) {
    if (!rightSet.has(item)) {
      return false;
    }
  }
  return true;
}

/**
 * Returns whether one relative file's UTF-8 content differs between snapshot dirs.
 *
 * @param fromRoot - Cached start snapshot directory
 * @param toRoot - Cached goal snapshot directory
 * @param relativePath - Path relative to the chapter tree root
 */
async function snapshotFileContentsDiffer(
  fromRoot: string,
  toRoot: string,
  relativePath: string,
): Promise<boolean> {
  const fromText = await readFile(snapshotRelativeFile(fromRoot, relativePath), "utf8");
  const toText = await readFile(snapshotRelativeFile(toRoot, relativePath), "utf8");
  return fromText !== toText;
}

/**
 * Returns whether explicit `entryFiles` differ between snapshots, stopping at the first proof.
 *
 * Existence mismatch (added/deleted) counts as a different file list. Matching
 * paths are compared sequentially and stop at the first content mismatch.
 *
 * @param fromRoot - Cached start snapshot directory
 * @param toRoot - Cached goal snapshot directory
 * @param entryFiles - Chapter `entryFiles`
 */
async function entryFilesHaveAnyChange(
  fromRoot: string,
  toRoot: string,
  entryFiles: readonly string[],
): Promise<boolean> {
  for (const relativePath of entryFiles) {
    const normalized = relativePath.split(/[/\\]/).join("/");
    const fromExists = await isFile(snapshotRelativeFile(fromRoot, normalized));
    const toExists = await isFile(snapshotRelativeFile(toRoot, normalized));
    if (fromExists !== toExists) {
      return true;
    }
    if (!fromExists) {
      continue;
    }
    if (await snapshotFileContentsDiffer(fromRoot, toRoot, normalized)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns whether discovered snapshot trees differ, stopping at the first proof.
 *
 * Compares the two directory file lists first. Equal lists are then compared
 * file-by-file until one content mismatch.
 *
 * @param fromRoot - Cached start snapshot directory
 * @param toRoot - Cached goal snapshot directory
 */
async function discoveredTreesHaveAnyChange(fromRoot: string, toRoot: string): Promise<boolean> {
  const fromFiles = await listDirectoryFiles(fromRoot);
  const toFiles = await listDirectoryFiles(toRoot);
  if (!fileListsMatch(fromFiles, toFiles)) {
    return true;
  }
  for (const relativePath of fromFiles) {
    if (await snapshotFileContentsDiffer(fromRoot, toRoot, relativePath)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns whether two snapshot trees have any file difference, without classifying every file.
 *
 * Same on-disk root is unchanged. Otherwise stops as soon as the file lists differ
 * or one file's content differs. Full U/M/D listing is left to expand.
 *
 * @param fromRoot - Cached start snapshot directory
 * @param toRoot - Cached goal snapshot directory
 * @param entryFiles - Explicit chapter entry files, or `undefined` to discover both trees
 */
export async function snapshotsHaveAnyChange(
  fromRoot: string,
  toRoot: string,
  entryFiles?: string[],
): Promise<boolean> {
  if (path.resolve(fromRoot) === path.resolve(toRoot)) {
    return false;
  }
  if (entryFiles !== undefined) {
    return entryFilesHaveAnyChange(fromRoot, toRoot, entryFiles);
  }
  return discoveredTreesHaveAnyChange(fromRoot, toRoot);
}

/**
 * Lists entry files that differ between two cached snapshot directories.
 *
 * When `entryFiles` is omitted, discovers files under the goal snapshot (`toRoot`).
 * Compares in parallel against the local cache rather than spawning git per file.
 *
 * @param fromRoot - Cached start snapshot directory
 * @param toRoot - Cached goal snapshot directory
 * @param entryFiles - Explicit chapter entry files, or `undefined` to discover `toRoot`
 */
export async function listChangedFilesInSnapshots(
  fromRoot: string,
  toRoot: string,
  entryFiles?: string[],
): Promise<ChangedEntryFile[]> {
  const paths =
    entryFiles ??
    (await listDirectoryFiles(toRoot)).sort((left, right) => left.localeCompare(right));
  /**
   * Classifies one entry file and drops unchanged paths.
   *
   * @param relativePath - Path relative to the chapter tree root
   */
  const classifyOne = async (relativePath: string): Promise<ChangedEntryFile | undefined> => {
    const changeKind = await classifySnapshotEntryChange(fromRoot, toRoot, relativePath);
    return changeKind === undefined ? undefined : { relativePath, changeKind };
  };
  const classified = await Promise.all(paths.map(classifyOne));
  const items: ChangedEntryFile[] = [];
  for (const item of classified) {
    if (item !== undefined) {
      items.push(item);
    }
  }
  return items;
}

/**
 * Returns the entry-file list for a chapter: explicit `entryFiles`, or all files
 * under `toDir` when omitted (empty `toDir` → no files).
 *
 * @param git - Git client
 * @param storePath - Materialized source store
 * @param source - Course source block
 * @param chapter - Chapter config
 */
export async function resolveChapterEntryFiles(
  git: GitClient,
  storePath: string,
  source: CourseSource,
  chapter: ChapterConfig,
): Promise<string[]> {
  if (chapter.entryFiles !== undefined) {
    return chapter.entryFiles;
  }
  const toSubtree = resolveSourceSubtreePath(source, chapter.toDir);
  if (toSubtree === undefined) {
    return [];
  }
  const files = await listSourceSubtreeFiles(git, storePath, toSubtree);
  return [...files].sort((left, right) => left.localeCompare(right));
}

/**
 * Classifies how an entry file changes between chapter `fromDir` and `toDir`.
 *
 * - `U` — added (only in to)
 * - `D` — deleted (only in from)
 * - `M` — modified (both sides, different content)
 * - `undefined` — present on both sides with identical content
 *
 * Empty snapshot sides (`undefined` dirs) count as missing files.
 *
 * @param git - Git client
 * @param storePath - Materialized source store
 * @param fromDir - Resolved start directory, or `undefined` for an empty start
 * @param toDir - Resolved goal directory, or `undefined` for an empty goal
 * @param relativePath - Path relative to the chapter tree root
 */
export async function classifyEntryChange(
  git: GitClient,
  storePath: string,
  fromDir: string | undefined,
  toDir: string | undefined,
  relativePath: string,
): Promise<EntryChangeKind | undefined> {
  const normalizedRelative = relativePath.split(/[/\\]/).join("/");
  const fromRepoPath =
    fromDir === undefined ? undefined : path.posix.join(fromDir, normalizedRelative);
  const toRepoPath = toDir === undefined ? undefined : path.posix.join(toDir, normalizedRelative);
  const fromExists =
    fromRepoPath === undefined ? false : await sourceFileExists(git, storePath, fromRepoPath);
  const toExists =
    toRepoPath === undefined ? false : await sourceFileExists(git, storePath, toRepoPath);

  if (!fromExists && toExists) {
    return "U";
  }
  if (fromExists && !toExists) {
    return "D";
  }
  if (!fromExists && !toExists) {
    return undefined;
  }

  const fromText =
    fromRepoPath === undefined ? undefined : await readSourceFile(git, storePath, fromRepoPath);
  const toText =
    toRepoPath === undefined ? undefined : await readSourceFile(git, storePath, toRepoPath);
  if (fromText === toText) {
    return undefined;
  }
  return "M";
}
