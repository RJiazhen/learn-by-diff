import type { ChapterConfig, CourseSource } from "@learn-by-diff/protocol";
import { resolveSourceSubtreePath } from "@learn-by-diff/protocol";
import path from "node:path";
import type { GitClient } from "../git/client.ts";
import { listSourceSubtreeFiles, readSourceFile, sourceFileExists } from "./sourceStore.ts";

/** SCM-style change letter for a chapter entry file. */
export type EntryChangeKind = "U" | "M" | "D";

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
