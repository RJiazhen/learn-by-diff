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
