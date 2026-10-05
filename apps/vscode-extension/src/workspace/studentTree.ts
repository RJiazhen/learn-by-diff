import { readFile } from "node:fs/promises";
import path from "node:path";
import type { GitClient } from "../git/client.ts";
import { ensureSourceSnapshot } from "../snapshot/archive.ts";
import { isCodeWorkspaceFileName } from "./paths.ts";
import { isRetainedRelativePath } from "./retain.ts";
import { listDirectoryFiles } from "./sourceStore.ts";

/** Paths ignored when comparing the student workspace to a chapter start. */
const STUDENT_COMPARE_SKIP = new Set([".git", ".learn", "README.md", ".gitignore"]);

/**
 * Lists student-visible files under the learning workspace root.
 *
 * Uses git exclude rules (`.gitignore`) so ignored trees such as `node_modules/`
 * are omitted. Also skips `.git`, `.learn`, `README.md`, `.gitignore`,
 * `.code-workspace`, and paths covered by `retain`.
 *
 * @param git - Git client
 * @param workspaceRoot - Learning workspace root
 * @param retain - Paths that must not count as student edits
 */
async function listStudentWorkspaceFiles(
  git: GitClient,
  workspaceRoot: string,
  retain: readonly string[],
): Promise<string[]> {
  const files = await git.listUnignoredWorkTreeFiles(workspaceRoot);
  return files.filter(
    (relative) => !isPreservedComparePath(relative) && !isRetainedRelativePath(relative, retain),
  );
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
 * Compares against the cached snapshot for the **current** chapter status (Not Started =
 * `fromDir`, Completed = `toDir`). The source clone is read only when that cache
 * is missing. Ignores `.git`, `.learn`, `README.md`, `.gitignore`,
 * `.code-workspace`, gitignored paths, and `retain` paths on both sides so
 * generated folders such as `node_modules/` do not count as edits.
 *
 * @param git - Git client
 * @param workspaceRoot - Learning workspace root
 * @param storePath - Materialized source clone, used only to fill a missing snapshot
 * @param fromDir - Resolved snapshot directory for the current chapter status, or `undefined` for empty
 * @param retain - Paths that must not count as student edits
 */
export async function hasStudentEditsSinceChapterStart(
  git: GitClient,
  workspaceRoot: string,
  storePath: string,
  fromDir: string | undefined,
  retain: readonly string[] = [],
): Promise<boolean> {
  if (fromDir === undefined) {
    return (await listStudentWorkspaceFiles(git, workspaceRoot, retain)).length > 0;
  }
  const snapshotRoot = await ensureSourceSnapshot(git, storePath, workspaceRoot, fromDir);
  return workspaceDiffersFromSnapshotDirectory(git, workspaceRoot, snapshotRoot, retain);
}

/**
 * Returns whether the student tree differs from a cached snapshot directory.
 *
 * Reads the cached snapshot directory. The same ignore rules apply as a compare
 * against the source clone.
 *
 * @param git - Git client
 * @param workspaceRoot - Learning workspace root
 * @param snapshotRoot - Cached chapter snapshot directory
 * @param retain - Paths that must not count as student edits
 */
async function workspaceDiffersFromSnapshotDirectory(
  git: GitClient,
  workspaceRoot: string,
  snapshotRoot: string,
  retain: readonly string[],
): Promise<boolean> {
  const snapshotFiles = (await listDirectoryFiles(snapshotRoot)).filter(
    (relative) => !isPreservedComparePath(relative) && !isRetainedRelativePath(relative, retain),
  );
  const ignored = await git.listIgnoredWorkTreePaths(workspaceRoot, snapshotFiles);
  const startFiles = new Set(snapshotFiles.filter((relative) => !ignored.has(relative)));
  const workspaceFiles = new Set(await listStudentWorkspaceFiles(git, workspaceRoot, retain));
  if (startFiles.size !== workspaceFiles.size) {
    return true;
  }
  for (const relative of startFiles) {
    if (!workspaceFiles.has(relative)) {
      return true;
    }
    const expected = await readFile(path.join(snapshotRoot, ...relative.split("/")), "utf8");
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
