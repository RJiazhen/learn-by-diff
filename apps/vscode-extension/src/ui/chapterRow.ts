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
 * Returns whether a chapter has no code changes between its start and goal.
 *
 * Author-declared `changedFiles` wins. An explicitly empty `entryFiles` list
 * means there is nothing to compare. A finished from/to check that found no
 * difference also counts; `undefined` while that check is still running does
 * not, so the row keeps its actions until the result is known.
 *
 * @param entryFiles - Chapter `entryFiles`, or `undefined` to discover at runtime
 * @param hasChanges - Whether from/to differ, or `undefined` while still loading
 * @param changedFiles - Author-declared diffs, or `undefined` to classify at runtime
 */
export function chapterRowHasNoChanges(
  entryFiles: string[] | undefined,
  hasChanges: boolean | undefined,
  changedFiles?: readonly ChapterChangedFile[],
): boolean {
  if (changedFiles !== undefined) {
    return changedFiles.length === 0;
  }
  if (entryFiles !== undefined && entryFiles.length === 0) {
    return true;
  }
  return hasChanges === false;
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

/**
 * Codicon for a chapter that is not the applied one.
 *
 * A neutral course-chapter marker, deliberately distinct from the Not Started
 * (`circle-large`) and Completed (`pass`) status icons so the leading slot never
 * reads as a status the chapter does not have.
 */
const CHAPTER_ROW_ICON = "mortar-board";

/**
 * Returns the codicon id for the leading slot of a chapter row.
 *
 * Every chapter row gets an icon, expandable or not. A current chapter shows
 * its applied status icon; any other chapter shows a neutral chapter marker.
 * VS Code drops the twistie column on non-collapsible rows, so setting an icon
 * unconditionally keeps one title edge across row kinds and while the applied
 * chapter changes.
 *
 * @param side - Snapshot side when this chapter is applied, or `undefined`
 */
export function chapterRowIconId(side: ChapterSnapshotSide | undefined): string {
  return side === undefined ? CHAPTER_ROW_ICON : chapterStatusIconId(side);
}
