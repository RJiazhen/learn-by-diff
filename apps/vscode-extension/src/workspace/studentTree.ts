import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { GitClient } from "../git/client.ts";
import { isCodeWorkspaceFileName } from "./paths.ts";

/** Paths ignored when comparing the student workspace to a chapter start. */
const STUDENT_COMPARE_SKIP = new Set([".git", ".learn", "README.md", ".gitignore"]);

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
 * Recursively lists relative file paths under `root`.
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
 * Lists student-visible files under the learning workspace root.
 *
 * @param workspaceRoot - Learning workspace root
 */
export async function listStudentWorkspaceFiles(workspaceRoot: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(workspaceRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    if (STUDENT_COMPARE_SKIP.has(entry.name) || isCodeWorkspaceFileName(entry.name)) {
      continue;
    }
    const absolute = path.join(workspaceRoot, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(absolute, entry.name)));
    } else if (entry.isFile()) {
      files.push(entry.name);
    }
  }
  return files.map((file) => file.split(/[/\\]/).join("/"));
}

/**
 * Reads a UTF-8 file from the source store, or `undefined` when missing.
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
 * Returns whether `relative` is a preserved workspace path that must not count as an edit.
 *
 * @param relative - Path relative to the student tree or snapshot root
 */
function isSkippedComparePath(relative: string): boolean {
  const top = relative.split("/")[0];
  if (top !== undefined && STUDENT_COMPARE_SKIP.has(top)) {
    return true;
  }
  return isCodeWorkspaceFileName(path.posix.basename(relative));
}

/**
 * Returns whether student-visible workspace files differ from a chapter snapshot.
 *
 * Compares against the snapshot for the **current** chapter status (Not Started =
 * `fromDir`, Completed = `toDir`). Ignores `.git`, `.learn`, `README.md`,
 * `.gitignore`, and `.code-workspace` on both sides so preserved tooling files
 * do not count as edits.
 *
 * @param git - Git client
 * @param workspaceRoot - Learning workspace root
 * @param storePath - Materialized source store
 * @param fromDir - Resolved snapshot directory for the current chapter status, or `undefined` for empty
 */
export async function hasStudentEditsSinceChapterStart(
  git: GitClient,
  workspaceRoot: string,
  storePath: string,
  fromDir: string | undefined,
): Promise<boolean> {
  if (fromDir === undefined) {
    return (await listStudentWorkspaceFiles(workspaceRoot)).length > 0;
  }
  const startFiles = new Set(
    (await listSourceSubtreeFiles(git, storePath, fromDir)).filter(
      (relative) => !isSkippedComparePath(relative),
    ),
  );
  const workspaceFiles = new Set(await listStudentWorkspaceFiles(workspaceRoot));

  if (startFiles.size !== workspaceFiles.size) {
    return true;
  }
  for (const relative of startFiles) {
    if (!workspaceFiles.has(relative)) {
      return true;
    }
  }

  for (const relative of startFiles) {
    const expected = await readSourceFile(git, storePath, path.posix.join(fromDir, relative));
    let actual: string;
    try {
      actual = await readFile(path.join(workspaceRoot, ...relative.split("/")), "utf8");
    } catch {
      return true;
    }
    if (actual !== expected) {
      return true;
    }
  }
  return false;
}
