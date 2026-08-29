/** Thrown when the host `git` executable cannot be run. */
export class GitError extends Error {
  /**
   * Creates a Git client error.
   *
   * @param message - Human-readable description
   * @param cause - Optional underlying error
   */
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "GitError";
  }
}
