import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { GitClient } from "../git/client.ts";
import { isCodeWorkspaceFileName } from "./paths.ts";
import { listSourceSubtreeFiles, readSourceFile } from "./sourceStore.ts";

/** Paths ignored when comparing the student workspace to a chapter start. */
const STUDENT_COMPARE_SKIP = new Set([".git", ".learn", "README.md", ".gitignore"]);

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
async function listStudentWorkspaceFiles(workspaceRoot: string): Promise<string[]> {
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
