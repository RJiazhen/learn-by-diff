import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { GitClient } from "../git/client.ts";

/** SCM-style change letter for a chapter entry file. */
export type EntryChangeKind = "U" | "M" | "D";

/**
 * Returns whether `storePath` is a bare/git-dir source mirror.
 *
 * @param storePath - Materialized source store
 */
async function isGitSourceStore(storePath: string): Promise<boolean> {
  try {
    await access(path.join(storePath, "HEAD"));
    await access(path.join(storePath, "objects"));
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns whether a path exists as a file under the source store.
 *
 * @param git - Git client
 * @param storePath - Materialized source store
 * @param repoRelativePath - Path from the source root (e.g. `hello/src/a.ts`)
 */
async function sourceFileExists(
  git: GitClient,
  storePath: string,
  repoRelativePath: string,
): Promise<boolean> {
  const normalized = repoRelativePath.split(/[/\\]/).join("/");
  if (await isGitSourceStore(storePath)) {
    const result = await git.run([
      "--git-dir",
      storePath,
      "ls-tree",
      "--name-only",
      "HEAD",
      "--",
      normalized,
    ]);
    return result.stdout.trim() !== "";
  }
  try {
    const full = path.join(storePath, ...normalized.split("/"));
    return (await stat(full)).isFile();
  } catch {
    return false;
  }
}

/**
 * Reads file contents from the source store, or `undefined` when missing.
 *
 * @param git - Git client
 * @param storePath - Materialized source store
 * @param repoRelativePath - Path from the source root
 */
async function readSourceFile(
  git: GitClient,
  storePath: string,
  repoRelativePath: string,
): Promise<string | undefined> {
  const normalized = repoRelativePath.split(/[/\\]/).join("/");
  if (await isGitSourceStore(storePath)) {
    try {
      const result = await git.run(["--git-dir", storePath, "show", `HEAD:${normalized}`]);
      return result.stdout;
    } catch {
      return undefined;
    }
  }
  try {
    return await readFile(path.join(storePath, ...normalized.split("/")), "utf8");
  } catch {
    return undefined;
  }
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
