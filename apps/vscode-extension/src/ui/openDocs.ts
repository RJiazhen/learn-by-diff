import { access } from "node:fs/promises";
import path from "node:path";
import {
  isHttpUrl,
  normalizeRelativeFilePath,
  resolveSourceSubtreePath,
  type ChapterConfig,
} from "@learn-by-diff/protocol";
import * as vscode from "vscode";
import { learningPaths } from "../workspace/paths.ts";
import type { LearningSession } from "../workspace/loader.ts";

/**
 * Opens a chapter's `docs` target: Simple Browser for http(s), otherwise a local file
 * from the source mirror (Markdown preview when the path ends in `.md`).
 *
 * @param session - Active learning session
 * @param chapterId - Chapter whose docs to open
 */
export async function openChapterDocs(session: LearningSession, chapterId: string): Promise<void> {
  const chapter = session.course.chapters.find((item) => item.id === chapterId);
  if (chapter === undefined) {
    throw new Error(`Unknown chapter: ${chapterId}`);
  }
  const docs = chapter.docs?.trim();
  if (docs === undefined || docs === "") {
    throw new Error(`Chapter ${chapterId} has no docs`);
  }

  if (isHttpUrl(docs)) {
    await openDocsUrl(docs);
    return;
  }

  const fileUri = await resolveChapterDocsFileUri(session, chapter, docs);
  await openDocsFile(fileUri);
}

/**
 * Opens an http(s) docs URL in the IDE Simple Browser when available.
 *
 * @param url - Absolute http(s) URL
 */
async function openDocsUrl(url: string): Promise<void> {
  try {
    await vscode.commands.executeCommand("simpleBrowser.show", url);
  } catch {
    await vscode.env.openExternal(vscode.Uri.parse(url));
  }
}

/**
 * Opens a local docs file; Markdown uses the preview editor when possible.
 *
 * @param uri - Absolute file URI under the source mirror
 */
async function openDocsFile(uri: vscode.Uri): Promise<void> {
  if (uri.fsPath.toLowerCase().endsWith(".md")) {
    try {
      await vscode.commands.executeCommand("markdown.showPreview", uri);
      return;
    } catch {
      // Fall through to a normal open when the Markdown preview command is unavailable.
    }
  }
  await vscode.commands.executeCommand("vscode.open", uri);
}

/**
 * Resolves a chapter-relative docs path under `toDir`, then `fromDir`, in the source mirror.
 *
 * @param session - Active learning session
 * @param chapter - Chapter config
 * @param docs - Relative file path from chapter yaml
 */
async function resolveChapterDocsFileUri(
  session: LearningSession,
  chapter: ChapterConfig,
  docs: string,
): Promise<vscode.Uri> {
  const relative = normalizeRelativeFilePath(docs);
  if (relative === undefined) {
    throw new Error(`Invalid docs path: ${docs}`);
  }

  const { sourceMirror } = learningPaths(session.workspaceRoot);
  const source = session.course.config.source;
  const candidates: string[] = [];
  for (const dir of [chapter.toDir, chapter.fromDir]) {
    const subtree = resolveSourceSubtreePath(source, dir);
    if (subtree !== undefined) {
      candidates.push(path.join(sourceMirror, subtree, ...relative.split("/")));
    }
  }

  for (const absolute of candidates) {
    try {
      await access(absolute);
      return vscode.Uri.file(absolute);
    } catch {
      // try next candidate
    }
  }

  const searched = candidates.length > 0 ? candidates.join(", ") : "(no chapter snapshot dirs)";
  throw new Error(`Docs file not found for chapter ${chapter.id}: ${docs} (looked in ${searched})`);
}
