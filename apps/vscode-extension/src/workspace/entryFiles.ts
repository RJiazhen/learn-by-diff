import type { ChapterConfig, CourseSource } from "@learn-by-diff/protocol";
import { resolveSourceSubtreePath } from "@learn-by-diff/protocol";
import type { GitClient } from "../git/client.ts";
import { listSourceSubtreeFiles } from "./studentTree.ts";

/**
 * Returns the entry-file list for a chapter: explicit `entryFiles`, or all files
 * under `toDir` when omitted (empty `toDir` → no files).
 *
 * @param git - Git client
 * @param storePath - Materialized source store
 * @param source - Course source block
 * @param chapter - Chapter config
 */
export async function resolveChapterEntryFiles(
  git: GitClient,
  storePath: string,
  source: CourseSource,
  chapter: ChapterConfig,
): Promise<string[]> {
  if (chapter.entryFiles !== undefined) {
    return chapter.entryFiles;
  }
  const toSubtree = resolveSourceSubtreePath(source, chapter.toDir);
  if (toSubtree === undefined) {
    return [];
  }
  const files = await listSourceSubtreeFiles(git, storePath, toSubtree);
  return [...files].sort((left, right) => left.localeCompare(right));
}
