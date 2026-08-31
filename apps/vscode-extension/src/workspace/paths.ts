import path from "node:path";

/** Hidden runtime directory at the learning workspace root. */
export const LEARN_DIR_NAME = ".learn";

/**
 * Returns well-known paths under a learning workspace root.
 *
 * @param workspaceRoot - Learning repository root
 */
export function learningPaths(workspaceRoot: string) {
  const learnDir = path.join(workspaceRoot, LEARN_DIR_NAME);
  return {
    workspaceRoot,
    learnDir,
    progressFile: path.join(learnDir, "progress.json"),
    sourceMirror: path.join(learnDir, "source.git"),
    courseDir: path.join(learnDir, "course"),
    snapshotsDir: path.join(learnDir, "snapshots"),
    refsDir: path.join(learnDir, "refs"),
  };
}

/**
 * Returns the snapshot directories for one chapter.
 *
 * @param workspaceRoot - Learning repository root
 * @param chapterId - Chapter identifier
 */
export function chapterSnapshotPaths(workspaceRoot: string, chapterId: string) {
  const { snapshotsDir } = learningPaths(workspaceRoot);
  const chapterDir = path.join(snapshotsDir, chapterId);
  return {
    chapterDir,
    fromDir: path.join(chapterDir, "from"),
    toDir: path.join(chapterDir, "to"),
  };
}

/**
 * Returns the runnable reference copy directory under `.learn/refs/`.
 *
 * `folderName` must match the Explorer workspace folder name (ordinal, title, status).
 *
 * @param workspaceRoot - Learning repository root
 * @param folderName - Same string as {@link chapterRefWorkspaceName}
 */
export function chapterRefPath(workspaceRoot: string, folderName: string): string {
  const { refsDir } = learningPaths(workspaceRoot);
  return path.join(refsDir, folderName);
}
