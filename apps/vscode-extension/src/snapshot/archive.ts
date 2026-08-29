import { rm } from "node:fs/promises";
import path from "node:path";
import type { GitClient } from "../git/client.ts";
import type { CourseSource } from "@learn-by-diff/protocol";
import { resolveSourceSubtreePath } from "@learn-by-diff/protocol";
import { chapterSnapshotPaths } from "../workspace/paths.ts";
import { exportSourceSubtree } from "../workspace/sourceStore.ts";

/**
 * Materializes from/to chapter directories into `.learn/snapshots/{chapterId}` for vscode.diff.
 *
 * @param git - Git client
 * @param sourceStore - Materialized source store (mirror or tree copy)
 * @param workspaceRoot - Learning workspace
 * @param chapterId - Chapter id
 * @param fromDir - Start directory relative to the source repo (or `source.root`)
 * @param toDir - Goal directory relative to the source repo (or `source.root`)
 * @param source - Course source block (applies optional `root` prefix)
 */
export async function writeChapterArchives(
  git: GitClient,
  sourceStore: string,
  workspaceRoot: string,
  chapterId: string,
  fromDir: string,
  toDir: string,
  source: CourseSource,
): Promise<{ fromDir: string; toDir: string }> {
  const paths = chapterSnapshotPaths(workspaceRoot, chapterId);
  await rm(paths.chapterDir, { recursive: true, force: true });
  await exportSourceSubtree(
    git,
    sourceStore,
    resolveSourceSubtreePath(source, fromDir),
    paths.fromDir,
  );
  await exportSourceSubtree(git, sourceStore, resolveSourceSubtreePath(source, toDir), paths.toDir);
  return { fromDir: paths.fromDir, toDir: paths.toDir };
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
