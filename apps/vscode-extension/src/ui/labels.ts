import * as vscode from "vscode";
import type { ChapterSnapshotSide } from "../workspace/state.ts";

/**
 * Returns the localized Explorer / status-bar label for an applied snapshot side.
 *
 * `.learn/refs/` folder names stay English (`Not Started` / `Completed`) so paths
 * do not change with the UI language.
 *
 * @param side - Start (`fromDir`) or finish (`toDir`)
 */
export function localizedSnapshotStatus(side: ChapterSnapshotSide): string {
  return side === "finish" ? vscode.l10n.t("Completed") : vscode.l10n.t("Not Started");
}
