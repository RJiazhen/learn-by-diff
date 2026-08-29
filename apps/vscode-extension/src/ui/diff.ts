import path from "node:path";
import * as vscode from "vscode";
import type { GitClient } from "../git/client.ts";
import { snapshotFile, writeChapterArchives } from "../snapshot/archive.ts";
import { learningPaths } from "../workspace/paths.ts";
import { currentChapter, type LearningSession } from "../workspace/session.ts";

/**
 * Opens vscode.diff for the current chapter's entry files (start snapshot vs goal snapshot).
 *
 * @param git - Git client
 * @param session - Active learning session
 */
export async function openChapterDiff(git: GitClient, session: LearningSession): Promise<void> {
  const chapter = currentChapter(session);
  const { sourceMirror } = learningPaths(session.workspaceRoot);
  const { fromDir, toDir } = await writeChapterArchives(
    git,
    sourceMirror,
    session.workspaceRoot,
    chapter.id,
    chapter.fromDir,
    chapter.toDir,
  );

  if (chapter.entryFiles.length === 0) {
    void vscode.window.showWarningMessage("This chapter has no entryFiles to diff.");
    return;
  }

  for (const relative of chapter.entryFiles) {
    const left = vscode.Uri.file(snapshotFile(fromDir, relative));
    const right = vscode.Uri.file(snapshotFile(toDir, relative));
    const title = `${chapter.title}: ${path.basename(relative)} (start ↔ goal)`;
    await vscode.commands.executeCommand("vscode.diff", left, right, title);
  }
}

/**
 * Opens the first entry file of the current chapter in the editor.
 *
 * @param session - Active learning session
 */
export async function openEntryFile(session: LearningSession): Promise<void> {
  const chapter = currentChapter(session);
  const relative = chapter.entryFiles[0];
  if (relative === undefined) {
    return;
  }
  const uri = vscode.Uri.file(path.join(session.workspaceRoot, relative));
  await vscode.window.showTextDocument(uri);
}
