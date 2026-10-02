import type { ChapterChangedFile } from "@learn-by-diff/protocol";
import type { ChapterSnapshotSide } from "../workspace/state.ts";

/**
 * Returns whether a chapter row should show an expand chevron.
 *
 * Author-declared `changedFiles` wins: empty hides the chevron, non-empty shows it.
 * Empty `entryFiles` never expands. Once a runtime from/to check is known, only
 * chapters with at least one difference expand. Until then, omitted or non-empty
 * `entryFiles` stay expandable so the row can appear before snapshot IO finishes.
 *
 * @param entryFiles - Chapter `entryFiles`, or `undefined` to discover at runtime
 * @param hasChanges - Whether from/to differ, or `undefined` while still loading
 * @param changedFiles - Author-declared diffs, or `undefined` to classify at runtime
 */
export function chapterRowIsExpandable(
  entryFiles: string[] | undefined,
  hasChanges: boolean | undefined,
  changedFiles?: readonly ChapterChangedFile[],
): boolean {
  if (changedFiles !== undefined) {
    return changedFiles.length > 0;
  }
  if (entryFiles !== undefined && entryFiles.length === 0) {
    return false;
  }
  if (hasChanges !== undefined) {
    return hasChanges;
  }
  return true;
}

/**
 * Returns the codicon id for an applied chapter status.
 *
 * Matches the Not Started (`circle-large`) and Completed (`pass`) action
 * icons so the row can show that icon in front of the title. The status words
 * stay in the row tooltip.
 *
 * @param side - Start (`fromDir`) or finish (`toDir`)
 */
export function chapterStatusIconId(side: ChapterSnapshotSide): "circle-large" | "pass" {
  return side === "finish" ? "pass" : "circle-large";
}
