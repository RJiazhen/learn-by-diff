import { access, cp, mkdir, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { GitClient } from "../git/client.ts";
import { GitError } from "../git/errors.ts";
import { isRemoteGitUrl } from "./resolveRepo.ts";

/**
 * Returns whether `dir` exists and is a directory.
 *
 * @param dir - Absolute path
 */
export async function directoryExists(dir: string): Promise<boolean> {
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
async function isGitRepository(root: string): Promise<boolean> {
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
 * Recursively lists relative file paths under `absDir`.
 *
 * @param absDir - Absolute directory to walk
 * @param relativePrefix - Relative prefix for returned paths
 */
async function walkFiles(absDir: string, relativePrefix: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(absDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const relative = relativePrefix === "" ? entry.name : `${relativePrefix}/${entry.name}`;
    const absolute = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(absolute, relative)));
    } else if (entry.isFile()) {
      files.push(relative.split(/[/\\]/).join("/"));
    }
  }
  return files;
}

/**
 * Lists file paths under a source-store subdirectory (relative to that subdirectory).
 *
 * @param git - Git client
 * @param storePath - Materialized source store
 * @param subdir - Chapter directory at the source root
 */
export async function listSourceSubtreeFiles(
  git: GitClient,
  storePath: string,
  subdir: string,
): Promise<string[]> {
  const normalizedSubdir = subdir.split(/[/\\]/).join("/");
  if (await isGitSourceStore(storePath)) {
    const result = await git.run([
      "--git-dir",
      storePath,
      "ls-tree",
      "-r",
      "--name-only",
      "HEAD",
      "--",
      normalizedSubdir,
    ]);
    const prefix = `${normalizedSubdir}/`;
    return result.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith(prefix))
      .map((line) => line.slice(prefix.length));
  }
  return walkFiles(path.join(storePath, ...normalizedSubdir.split("/")), "");
}

/**
 * Returns whether a path exists as a file under the source store.
 *
 * @param git - Git client
 * @param storePath - Materialized source store
 * @param repoRelativePath - Path from the source root
 */
export async function sourceFileExists(
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
 * Reads a UTF-8 file from the source store, or `undefined` when missing.
 *
 * @param git - Git client
 * @param storePath - Materialized source store
 * @param repoRelativePath - Path from the source root
 */
export async function readSourceFile(
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
 * Copies each top-level entry from `fromDir` into `destDir`, replacing any
 * existing file or directory of the same name (does not merge directory trees).
 *
 * Names present only in `destDir` are left in place; callers that need a full
 * replace must clear those first.
 *
 * @param fromDir - Source directory whose children are copied
 * @param destDir - Destination directory (created if missing)
 */
async function copyChildrenReplacing(fromDir: string, destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true });
  const entries = await readdir(fromDir);
  for (const name of entries) {
    const destPath = path.join(destDir, name);
    await rm(destPath, { recursive: true, force: true });
    await cp(path.join(fromDir, name), destPath, { recursive: true });
  }
}

/**
 * Exports `subdir` from the source store into `destDir`.
 *
 * Same-named directories are replaced rather than merged. When `subdir` is
 * `undefined`, creates an empty `destDir` (empty chapter snapshot).
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
    const staging = await mkdtemp(path.join(tmpdir(), "learn-by-diff-export-"));
    try {
      await git.archiveSubtree(storePath, subdir, staging);
      await copyChildrenReplacing(staging, destDir);
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
    return;
  }
  const from = path.join(storePath, ...subdir.split(/[/\\]/).filter(Boolean));
  await copyChildrenReplacing(from, destDir);
}
