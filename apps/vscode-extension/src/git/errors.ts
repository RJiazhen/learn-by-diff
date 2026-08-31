/** Message when the git executable is missing from PATH. */
export const GIT_NOT_FOUND_MESSAGE =
  "git was not found on PATH. Install Git and reopen the window.";

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
