import { readFile } from "node:fs/promises";
import path from "node:path";
import * as vscode from "vscode";
import type { GitClient } from "../git/client.ts";
import { snapshotFile, writeChapterArchives } from "../snapshot/archive.ts";
import { resolveChapterEntryFiles } from "../workspace/entryChange.ts";
import type { LearningSession } from "../workspace/loader.ts";
import { learningPaths } from "../workspace/paths.ts";
import { chapterOrdinal } from "../workspace/session.ts";
import { decodeSnapshotUriPath, encodeSnapshotUriPath } from "./snapshotUri.ts";

/**
 * Virtual scheme for vscode.diff sides so Explorer does not reveal `.learn/snapshots`.
 */
export const SNAPSHOT_DIFF_SCHEME = "learnbydiff-snapshot";

/**
 * Serves snapshot file text (or empty for missing sides) to the diff editor.
 */
export class SnapshotDiffContentProvider implements vscode.TextDocumentContentProvider {
  /**
   * Returns snapshot file contents for `uri`, or an empty document when the file is missing.
   *
   * @param uri - Snapshot-diff URI whose path encodes the absolute snapshot file path
   */
  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    try {
      return await readFile(decodeSnapshotUriPath(uri.path), "utf8");
    } catch {
      return "";
    }
  }
}

/**
 * Builds a virtual URI for one vscode.diff side from a snapshot file path.
 *
 * Uses a custom scheme so opening the diff does not select `.learn/snapshots` in Explorer.
 *
 * @param fsPath - Absolute snapshot file path (file may be missing)
 */
function uriForDiffSide(fsPath: string): vscode.Uri {
  return vscode.Uri.from({
    scheme: SNAPSHOT_DIFF_SCHEME,
    path: encodeSnapshotUriPath(fsPath),
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
    void vscode.window.showWarningMessage(vscode.l10n.t("Unknown chapter: {0}", chapterId));
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
      vscode.l10n.t("File {0} is not an entry file for chapter {1}.", relativePath, chapter.title),
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

  const left = uriForDiffSide(snapshotFile(fromDir, relativePath));
  const right = uriForDiffSide(snapshotFile(toDir, relativePath));
  const ordinal = chapterOrdinal(chapterIndex, session.course.chapters.length);
  const title = `${ordinal}-${chapter.title}: ${path.basename(relativePath)}`;
  await vscode.commands.executeCommand("vscode.diff", left, right, title);
}
