/** Thrown when Open Course would replace files in a non-empty destination folder. */
export class NonEmptyLearningTargetError extends Error {
  /**
   * Creates an error that blocks initializing a learning workspace over existing files.
   *
   * @param learningRoot - Absolute path that is not empty
   */
  constructor(readonly learningRoot: string) {
    super(`learning workspace folder is not empty: ${learningRoot}`);
    this.name = "NonEmptyLearningTargetError";
  }
}

/** Thrown when applying a chapter snapshot is blocked by student edits vs the last applied tree. */
export class DirtyWorkspaceError extends Error {
  /**
   * Creates an error that asks the UI to confirm discarding local changes.
   *
   * @param workspaceRoot - Learning repository root
   */
  constructor(readonly workspaceRoot: string) {
    super("the learning workspace has uncommitted changes");
    this.name = "DirtyWorkspaceError";
  }
}
