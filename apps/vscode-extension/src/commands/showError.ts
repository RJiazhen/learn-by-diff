import { ProtocolError } from "@learn-by-diff/protocol";
import * as vscode from "vscode";
import { GitError } from "../git/errors.ts";

/**
 * Shows a Git or generic error in a message box.
 *
 * @param error - Thrown value
 */
export function showError(error: unknown): void {
  if (error instanceof GitError || error instanceof ProtocolError) {
    void vscode.window.showErrorMessage(error.message);
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  void vscode.window.showErrorMessage(message);
}
