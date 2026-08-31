import path from "node:path";

/** Hidden runtime directory at the learning workspace root. */
export const LEARN_DIR_NAME = ".learn";

/** Pre-root-location workspace file under `.learn/` (migrated on open). */
export const LEGACY_LEARN_WORKSPACE_FILE_NAME = "learn-by-diff.code-workspace";

/**
 * Returns whether `fileName` is a VS Code / Cursor `.code-workspace` file.
 *
 * @param fileName - Basename only
 */
export function isCodeWorkspaceFileName(fileName: string): boolean {
  return fileName.endsWith(".code-workspace");
}

/**
 * Returns the learning `.code-workspace` filename, matching the directory name.
 *
 * Open Recent labels a workspace from this filename, so it stays aligned with
 * the course folder the student created.
 *
 * @param workspaceRoot - Learning repository root
 */
export function learningWorkspaceFileName(workspaceRoot: string): string {
  return `${path.basename(path.resolve(workspaceRoot))}.code-workspace`;
}

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
    workspaceFile: path.join(workspaceRoot, learningWorkspaceFileName(workspaceRoot)),
    legacyWorkspaceFile: path.join(learnDir, LEGACY_LEARN_WORKSPACE_FILE_NAME),
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
