import * as vscode from "vscode";
import { appliedSnapshotSide, chapterSnapshotStatusLabel } from "../workspace/state.ts";
import { chapterPosition, currentChapter, type LearningSession } from "../workspace/session.ts";

/**
 * Status bar item showing the current course chapter; click runs Next Chapter.
 *
 * @param context - Extension context for disposal
 * @returns Setter for the active session
 */
export function registerStatusBar(
  context: vscode.ExtensionContext,
): (session: LearningSession | undefined) => void {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 10);
  item.command = "learnByDiff.nextChapter";
  context.subscriptions.push(item);

  /**
   * Updates the status bar from the active session.
   *
   * @param session - Active session, or `undefined` to hide
   */
  function update(session: LearningSession | undefined): void {
    if (session === undefined) {
      item.hide();
      return;
    }
    const chapter = currentChapter(session);
    const position = chapterPosition(session.course, chapter.id);
    const side = chapterSnapshotStatusLabel(appliedSnapshotSide(session.progress));
    item.text = `$(mortar-board) ${session.course.config.title} · ${position} ${chapter.title} · ${side}`;
    item.tooltip = "LearnByDiff: Next Chapter";
    item.show();
  }

  return update;
}
