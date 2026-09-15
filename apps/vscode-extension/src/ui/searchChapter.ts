import type { ChapterConfig } from "@learn-by-diff/protocol";
import { chapterOrdinal } from "../workspace/session.ts";

/** One QuickPick row for jumping to a chapter in the Explorer list. */
export interface ChapterSearchPick {
  /** Chapter id to reveal after the user picks a row. */
  chapterId: string;
  /** Explorer-style `ordinal-title` label. */
  label: string;
  /** Chapter id shown as QuickPick description (also searchable). */
  description: string;
  /** Whether this row is the currently applied chapter. */
  current: boolean;
}

/**
 * Builds QuickPick rows so students can filter chapters by ordinal, title, or id.
 *
 * Labels match the Explorer chapter list (`01-Title`). The chapter id is in
 * `description` so VS Code's QuickPick filter can match it too.
 *
 * @param chapters - Course chapters in display order
 * @param currentChapterId - Applied chapter id
 */
export function chapterSearchPicks(
  chapters: readonly ChapterConfig[],
  currentChapterId: string,
): ChapterSearchPick[] {
  const total = chapters.length;
  /**
   * Builds one QuickPick row from a chapter and its display index.
   *
   * @param chapter - Chapter config
   * @param index - Zero-based chapter index
   */
  function toPick(chapter: ChapterConfig, index: number): ChapterSearchPick {
    return {
      chapterId: chapter.id,
      label: `${chapterOrdinal(index, total)}-${chapter.title}`,
      description: chapter.id,
      current: chapter.id === currentChapterId,
    };
  }
  return chapters.map(toPick);
}
