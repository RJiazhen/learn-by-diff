import type { ChapterConfig, Course } from "@learn-by-diff/protocol";
import type { GitClient } from "../git/client.ts";
import { checkoutChapter, materializeChapterSnapshots } from "./creator.ts";
import { DirtyWorkspaceError } from "./errors.ts";
import type { LearningSession } from "./loader.ts";

export type { LearningSession };

/**
 * Returns the chapter currently selected in progress, or the first chapter.
 *
 * @param session - Loaded session
 */
export function currentChapter(session: LearningSession): ChapterConfig {
  const match = session.course.chapters.find((chapter) => chapter.id === session.progress.chapter);
  const first = session.course.chapters[0];
  if (match !== undefined) {
    return match;
  }
  if (first === undefined) {
    throw new Error("course has no chapters");
  }
  return first;
}

/**
 * Returns the next chapter after the current one, if any.
 *
 * @param session - Loaded session
 */
export function nextChapter(session: LearningSession): ChapterConfig | undefined {
  const current = currentChapter(session);
  const index = session.course.chapters.findIndex((chapter) => chapter.id === current.id);
  return session.course.chapters[index + 1];
}

/**
 * Returns the previous chapter, if any.
 *
 * @param session - Loaded session
 */
export function previousChapter(session: LearningSession): ChapterConfig | undefined {
  const current = currentChapter(session);
  const index = session.course.chapters.findIndex((chapter) => chapter.id === current.id);
  return index > 0 ? session.course.chapters[index - 1] : undefined;
}

/**
 * Checks dirtiness, exports the chapter start tree, and writes from/to snapshots.
 *
 * @param git - Git client
 * @param session - Session to mutate via checkout
 * @param chapterId - Target chapter
 * @param force - Skip dirty check when the user already confirmed
 */
export async function switchToChapter(
  git: GitClient,
  session: LearningSession,
  chapterId: string,
  force = false,
): Promise<void> {
  if (!force && (await git.isWorkTreeDirty(session.workspaceRoot))) {
    throw new DirtyWorkspaceError(session.workspaceRoot);
  }
  await checkoutChapter(git, session.workspaceRoot, session.course, chapterId);
  session.progress = { chapter: chapterId, completed: false };
  const chapter = session.course.chapters.find((item) => item.id === chapterId);
  if (chapter === undefined) {
    return;
  }
  await materializeChapterSnapshots(
    git,
    session.workspaceRoot,
    chapter.id,
    chapter.fromDir,
    chapter.toDir,
  );
}

/**
 * Returns the zero-padded 1-based chapter ordinal with width matching `total`.
 *
 * Examples: 3 chapters → `1`; 12 chapters → `01`; 100 chapters → `001`.
 *
 * @param index - Zero-based chapter index
 * @param total - Total number of chapters
 */
export function chapterOrdinal(index: number, total: number): string {
  const width = Math.max(1, String(Math.max(total, 1)).length);
  return String(index + 1).padStart(width, "0");
}

/**
 * Returns a 1-based chapter index label such as `02/10`.
 *
 * @param course - Course
 * @param chapterId - Current chapter id
 */
export function chapterPosition(course: Course, chapterId: string): string {
  const index = course.chapters.findIndex((chapter) => chapter.id === chapterId);
  const current = index >= 0 ? index : 0;
  const total = course.chapters.length;
  return `${chapterOrdinal(current, total)}/${chapterOrdinal(Math.max(total, 1) - 1, total)}`;
}
