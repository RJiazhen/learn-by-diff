/**
 * Returns finished chapter file names eligible to show (undefined until chapter 1 is done).
 *
 * @param sortedNames - Chapter JSONC basenames in course order
 * @param finishedFiles - Files whose config and snapshots are both done
 */
export function visibleFinishedChapterFiles(
  sortedNames: readonly string[],
  finishedFiles: ReadonlySet<string>,
): string[] | undefined {
  const firstName = sortedNames[0];
  if (firstName === undefined || !finishedFiles.has(firstName)) {
    return undefined;
  }
  return sortedNames.filter((name) => finishedFiles.has(name));
}

/**
 * Returns the next prefix of finished chapters to show (one new chapter per call).
 *
 * Returns `undefined` until chapter 1 is finished, or when every currently finished
 * chapter has already been revealed. Callers should reveal this prefix, then call
 * again so the tree grows one row at a time as download progress continues.
 *
 * @param sortedNames - Chapter JSONC basenames in course order
 * @param finishedFiles - Files whose config and snapshots are both done
 * @param alreadyRevealedCount - How many chapter rows are already shown
 */
export function nextRevealChapterFiles(
  sortedNames: readonly string[],
  finishedFiles: ReadonlySet<string>,
  alreadyRevealedCount: number,
): string[] | undefined {
  const visible = visibleFinishedChapterFiles(sortedNames, finishedFiles);
  if (visible === undefined || visible.length <= alreadyRevealedCount) {
    return undefined;
  }
  return visible.slice(0, alreadyRevealedCount + 1);
}
