import { readFile } from "node:fs/promises";
import path from "node:path";
import type { GitClient } from "../git/client.ts";
import { isCodeWorkspaceFileName } from "./paths.ts";
import { listSourceSubtreeFiles, readSourceFile } from "./sourceStore.ts";

/** Paths ignored when comparing the student workspace to a chapter start. */
const STUDENT_COMPARE_SKIP = new Set([".git", ".learn", "README.md", ".gitignore"]);

/**
 * Lists student-visible files under the learning workspace root.
 *
 * Uses git exclude rules (`.gitignore`) so ignored trees such as `node_modules/`
 * are omitted. Also skips `.git`, `.learn`, `README.md`, `.gitignore`, and
 * `.code-workspace`.
 *
 * @param git - Git client
 * @param workspaceRoot - Learning workspace root
 */
async function listStudentWorkspaceFiles(git: GitClient, workspaceRoot: string): Promise<string[]> {
  const files = await git.listUnignoredWorkTreeFiles(workspaceRoot);
  return files.filter((relative) => !isPreservedComparePath(relative));
}

/**
 * Returns whether `relative` is a preserved workspace path that must not count as an edit.
 *
 * @param relative - Path relative to the student tree or snapshot root
 */
function isPreservedComparePath(relative: string): boolean {
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
 * `.gitignore`, `.code-workspace`, and gitignored paths on both sides so
 * generated folders such as `node_modules/` do not count as edits.
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
    return (await listStudentWorkspaceFiles(git, workspaceRoot)).length > 0;
  }
  const snapshotFiles = (await listSourceSubtreeFiles(git, storePath, fromDir)).filter(
    (relative) => !isPreservedComparePath(relative),
  );
  const ignored = await git.listIgnoredWorkTreePaths(workspaceRoot, snapshotFiles);
  const startFiles = new Set(snapshotFiles.filter((relative) => !ignored.has(relative)));
  const workspaceFiles = new Set(await listStudentWorkspaceFiles(git, workspaceRoot));

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
