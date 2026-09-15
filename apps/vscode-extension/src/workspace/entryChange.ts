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
