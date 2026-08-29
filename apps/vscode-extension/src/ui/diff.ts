import { access, stat } from "node:fs/promises";
import path from "node:path";
import * as vscode from "vscode";
import type { GitClient } from "../git/client.ts";
import { snapshotFile, writeChapterArchives } from "../snapshot/archive.ts";
import { resolveChapterEntryFiles } from "../workspace/entryFiles.ts";
import { learningPaths } from "../workspace/paths.ts";
import { chapterOrdinal, currentChapter, type LearningSession } from "../workspace/session.ts";

/** Scheme for missing snapshot sides so vscode.diff can open adds/deletes. */
export const EMPTY_DIFF_SCHEME = "learnbydiff-empty";

/**
 * Provides empty document content for missing from/to snapshot files.
 */
export class EmptyDiffContentProvider implements vscode.TextDocumentContentProvider {
  /**
   * Returns an empty string for any empty-diff URI.
   */
  provideTextDocumentContent(): string {
    return "";
  }
}

/**
 * Returns a URI usable as a vscode.diff side, using an empty virtual doc when the file is missing.
 *
 * @param fsPath - Absolute snapshot file path
 */
export async function uriForDiffSide(fsPath: string): Promise<vscode.Uri> {
  try {
    if ((await stat(fsPath)).isFile()) {
      return vscode.Uri.file(fsPath);
    }
  } catch {
    // Missing or not a file — fall through to empty virtual document.
  }
  // Avoid `//…` paths (illegal without an authority) when `fsPath` is absolute.
  const normalized = fsPath
    .split(/[/\\]/)
    .filter((segment) => segment !== "")
    .join("/");
  return vscode.Uri.from({
    scheme: EMPTY_DIFF_SCHEME,
    path: `/${normalized}`,
    query: path.basename(fsPath),
  });
}

/**
 * Opens vscode.diff for one chapter entry file (from snapshot ↔ to snapshot).
 *
 * Missing sides (adds/deletes) use an empty virtual document so the editor still opens,
 * matching Source Control behavior. The tab title uses the same ordinal-title label as
 * the chapter list (no fromDir/toDir — chapters need not depend on a prior step).
 *
 * @param git - Git client
 * @param session - Active learning session
 * @param chapterId - Chapter that owns the entry file
 * @param relativePath - Path from the chapter entry-file list (explicit or auto)
 */
export async function openChapterFileDiff(
  git: GitClient,
  session: LearningSession,
  chapterId: string,
  relativePath: string,
): Promise<void> {
  const chapterIndex = session.course.chapters.findIndex((item) => item.id === chapterId);
  const chapter = chapterIndex >= 0 ? session.course.chapters[chapterIndex] : undefined;
  if (chapter === undefined) {
    void vscode.window.showWarningMessage(`Unknown chapter: ${chapterId}`);
    return;
  }
  const { sourceMirror } = learningPaths(session.workspaceRoot);
  const entryFiles = await resolveChapterEntryFiles(
    git,
    sourceMirror,
    session.course.config.source,
    chapter,
  );
  if (!entryFiles.includes(relativePath)) {
    void vscode.window.showWarningMessage(
      `File ${relativePath} is not an entry file for chapter ${chapter.title}.`,
    );
    return;
  }

  const { fromDir, toDir } = await writeChapterArchives(
    git,
    sourceMirror,
    session.workspaceRoot,
    chapter.id,
    chapter.fromDir,
    chapter.toDir,
    session.course.config.source,
  );

  const leftPath = snapshotFile(fromDir, relativePath);
  const rightPath = snapshotFile(toDir, relativePath);
  const left = await uriForDiffSide(leftPath);
  const right = await uriForDiffSide(rightPath);
  const ordinal = chapterOrdinal(chapterIndex, session.course.chapters.length);
  const title = `${ordinal}-${chapter.title}: ${path.basename(relativePath)}`;
  await vscode.commands.executeCommand("vscode.diff", left, right, title);
}

/**
 * Opens the first entry file of the current chapter in the editor.
 *
 * @param git - Git client
 * @param session - Active learning session
 */
export async function openEntryFile(git: GitClient, session: LearningSession): Promise<void> {
  const chapter = currentChapter(session);
  const { sourceMirror } = learningPaths(session.workspaceRoot);
  const entryFiles = await resolveChapterEntryFiles(
    git,
    sourceMirror,
    session.course.config.source,
    chapter,
  );
  const relative = entryFiles[0];
  if (relative === undefined) {
    return;
  }
  const uri = vscode.Uri.file(path.join(session.workspaceRoot, relative));
  try {
    await access(uri.fsPath);
  } catch {
    void vscode.window.showWarningMessage(`Entry file not found in workspace: ${relative}`);
    return;
  }
  await vscode.window.showTextDocument(uri);
}
