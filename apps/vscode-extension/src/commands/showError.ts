import { ProtocolError } from "@learn-by-diff/protocol";
import * as vscode from "vscode";
import { GIT_NOT_FOUND_MESSAGE, GitError } from "../git/errors.ts";

/**
 * Shows a Git or generic error in a message box.
 *
 * @param error - Thrown value
 */
export function showError(error: unknown): void {
  if (error instanceof GitError) {
    void vscode.window.showErrorMessage(localizeGitError(error));
    return;
  }
  if (error instanceof ProtocolError) {
    void vscode.window.showErrorMessage(error.message);
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  void vscode.window.showErrorMessage(message);
}

/**
 * Returns a localized message for Git errors whose English text we control.
 *
 * Git stderr and other host messages stay as returned by the process.
 *
 * @param error - Git client failure
 */
function localizeGitError(error: GitError): string {
  if (error.message === GIT_NOT_FOUND_MESSAGE) {
    return vscode.l10n.t("git was not found on PATH. Install Git and reopen the window.");
  }
  return error.message;
}
