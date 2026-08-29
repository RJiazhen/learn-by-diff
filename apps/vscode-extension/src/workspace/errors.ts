/** Thrown when chapter switch is blocked by uncommitted student changes. */
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
