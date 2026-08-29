import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { GitClient } from "../git/client.ts";
import { chapterSnapshotPaths } from "../workspace/paths.ts";

/**
 * Archives from/to refs into `.learn/snapshots/{chapterId}` for vscode.diff.
 *
 * @param git - Git client
 * @param gitDir - Bare source mirror
 * @param workspaceRoot - Learning workspace
 * @param chapterId - Chapter id
 * @param fromRef - Start ref
 * @param toRef - Goal ref
 */
export async function writeChapterArchives(
  git: GitClient,
  gitDir: string,
  workspaceRoot: string,
  chapterId: string,
  fromRef: string,
  toRef: string,
): Promise<{ fromDir: string; toDir: string }> {
  const { fromDir, toDir } = chapterSnapshotPaths(workspaceRoot, chapterId);
  await mkdir(fromDir, { recursive: true });
  await mkdir(toDir, { recursive: true });
  await git.archive(gitDir, fromRef, fromDir);
  await git.archive(gitDir, toRef, toDir);
  return { fromDir, toDir };
}

/**
 * Joins a snapshot root with a course-relative file path.
 *
 * @param snapshotRoot - `from` or `to` snapshot directory
 * @param relativeFile - Path from the chapter config
 */
export function snapshotFile(snapshotRoot: string, relativeFile: string): string {
  return path.join(snapshotRoot, ...relativeFile.split(/[/\\]/));
}
