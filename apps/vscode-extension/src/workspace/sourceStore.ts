import { access, cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import type { GitClient } from "../git/client.ts";
import { GitError } from "../git/errors.ts";
import { isRemoteGitUrl } from "./resolveRepo.ts";

/**
 * Returns whether `dir` exists and is a directory.
 *
 * @param dir - Absolute path
 */
async function directoryExists(dir: string): Promise<boolean> {
  try {
    return (await stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Returns whether `root` is a git worktree or bare repository.
 *
 * @param root - Absolute filesystem path
 */
export async function isGitRepository(root: string): Promise<boolean> {
  if (!(await directoryExists(root))) {
    return false;
  }
  try {
    await access(path.join(root, ".git"));
    return true;
  } catch {
    // bare repo: HEAD + objects
  }
  try {
    await access(path.join(root, "HEAD"));
    await access(path.join(root, "objects"));
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns whether `storePath` looks like a bare/git-dir mirror (vs a plain tree copy).
 *
 * @param storePath - `.learn/source.git` path
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
 * Materializes the declared source repository into `storePath` for chapter exports.
 *
 * Remote URLs and local git repos become a bare mirror. Plain local directories
 * (e.g. committed `examples/demo-source`) are copied as a file tree.
 *
 * @param git - Git client
 * @param sourceRepository - Resolved source URL or absolute path
 * @param storePath - Destination under `.learn` (typically `source.git`)
 * @param onLog - Optional progress logger
 */
export async function materializeSourceStore(
  git: GitClient,
  sourceRepository: string,
  storePath: string,
  onLog?: (line: string) => void,
): Promise<void> {
  await rm(storePath, { recursive: true, force: true });

  if (isRemoteGitUrl(sourceRepository)) {
    onLog?.(`Cloning source mirror… (${sourceRepository})`);
    await git.cloneMirror(sourceRepository, storePath);
    return;
  }

  if (!(await directoryExists(sourceRepository))) {
    throw new Error(`source repository not found: ${sourceRepository}`);
  }

  if (await isGitRepository(sourceRepository)) {
    onLog?.(`Cloning source mirror… (${sourceRepository})`);
    await git.cloneMirror(sourceRepository, storePath);
    return;
  }

  onLog?.(`Copying local source tree… (${sourceRepository})`);
  await mkdir(path.dirname(storePath), { recursive: true });
  await cp(sourceRepository, storePath, { recursive: true });
}

/**
 * Asserts that `subdir` exists under a source store (git mirror or plain tree).
 *
 * @param git - Git client
 * @param storePath - Materialized source store
 * @param subdir - Chapter directory path relative to the source root (nested OK)
 */
export async function assertSourceSubtree(
  git: GitClient,
  storePath: string,
  subdir: string,
): Promise<void> {
  if (await isGitSourceStore(storePath)) {
    await git.assertSubtree(storePath, subdir);
    return;
  }
  const target = path.join(storePath, ...subdir.split(/[/\\]/).filter(Boolean));
  if (!(await directoryExists(target))) {
    throw new GitError(`source subdirectory not found: ${subdir}`);
  }
}

/**
 * Exports `subdir` from the source store into `destDir`.
 *
 * When `subdir` is `undefined`, creates an empty `destDir` (empty chapter snapshot).
 *
 * @param git - Git client
 * @param storePath - Materialized source store
 * @param subdir - Chapter directory path relative to the source root, or `undefined` for empty
 * @param destDir - Destination directory (contents of the chapter tree)
 */
export async function exportSourceSubtree(
  git: GitClient,
  storePath: string,
  subdir: string | undefined,
  destDir: string,
): Promise<void> {
  await mkdir(destDir, { recursive: true });
  if (subdir === undefined || subdir.trim() === "") {
    return;
  }
  await assertSourceSubtree(git, storePath, subdir);
  if (await isGitSourceStore(storePath)) {
    await git.archiveSubtree(storePath, subdir, destDir);
    return;
  }
  const from = path.join(storePath, ...subdir.split(/[/\\]/).filter(Boolean));
  const entries = await readdir(from);
  for (const name of entries) {
    await cp(path.join(from, name), path.join(destDir, name), { recursive: true });
  }
}
