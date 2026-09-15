import * as vscode from "vscode";
import type { SnapshotPrefetchProgress } from "./prefetch.ts";

/**
 * Updates a VS Code notification with one unique source-tree download step.
 *
 * @param progress - Notification progress reporter
 * @param info - Trees completed, total, and the subtree just written
 */
export function reportSnapshotPrefetchProgress(
  progress: vscode.Progress<{ message?: string; increment?: number }>,
  info: SnapshotPrefetchProgress,
): void {
  const label = info.subtree === undefined ? vscode.l10n.t("(empty tree)") : info.subtree;
  progress.report({
    message: vscode.l10n.t("{0} ({1} of {2})", label, info.completed, info.total),
    increment: info.increment,
  });
}
