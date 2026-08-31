import type { Course } from "@learn-by-diff/protocol";
import { resolveSourceSubtreePath } from "@learn-by-diff/protocol";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import type { GitClient } from "../git/client.ts";
import { ensureLearnGitignore } from "./creator.ts";
import type { LearningSession } from "./loader.ts";
import { chapterRefPath, learningPaths } from "./paths.ts";
import { chapterOrdinal } from "./session.ts";
import { exportSourceSubtree } from "./sourceStore.ts";
import { chapterSnapshotStatusLabel, type ChapterSnapshotSide } from "./state.ts";

/**
 * Explorer name and `.learn/refs/` directory name, such as `02-Particles (Completed)`.
 *
 * @param course - Loaded course
 * @param chapterId - Chapter to label
 * @param side - Start or finish snapshot
 */
export function chapterRefWorkspaceName(
  course: Course,
  chapterId: string,
  side: ChapterSnapshotSide,
): string {
  const index = course.chapters.findIndex((chapter) => chapter.id === chapterId);
  const chapter = index >= 0 ? course.chapters[index] : undefined;
  const ordinal = chapterOrdinal(Math.max(index, 0), course.chapters.length);
  const title = chapter?.title ?? chapterId;
  return `${ordinal}-${title} (${chapterSnapshotStatusLabel(side)})`;
}

/**
 * Exports a chapter Not Started or Completed snapshot into `.learn/refs/…`.
 *
 * Does not overwrite the student working tree. Replaces any previous copy at
 * the same path. `.learn/refs/` is gitignored.
 *
 * @param git - Git client
 * @param session - Active learning session
 * @param chapterId - Chapter to export
 * @param side - Start (`fromDir`) or finish (`toDir`)
 * @returns Absolute path of the reference folder
 */
export async function materializeChapterRef(
  git: GitClient,
  session: LearningSession,
  chapterId: string,
  side: ChapterSnapshotSide,
): Promise<string> {
  const chapter = session.course.chapters.find((item) => item.id === chapterId);
  if (chapter === undefined) {
    throw new Error(`unknown chapter: ${chapterId}`);
  }
  const snapshotDir = side === "finish" ? chapter.toDir : chapter.fromDir;
  const dest = chapterRefPath(
    session.workspaceRoot,
    chapterRefWorkspaceName(session.course, chapterId, side),
  );
  await emptyDirectory(dest);
  const { sourceMirror } = learningPaths(session.workspaceRoot);
  await exportSourceSubtree(
    git,
    sourceMirror,
    resolveSourceSubtreePath(session.course.config.source, snapshotDir),
    dest,
  );
  await ensureLearnGitignore(session.workspaceRoot);
  return dest;
}

/**
 * Deletes every child of `dir`, creating `dir` when it does not exist.
 *
 * Leaves `dir` itself in place so it can stay mounted as a workspace folder.
 *
 * @param dir - Directory to empty
 */
async function emptyDirectory(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    await rm(path.join(dir, entry.name), { recursive: true, force: true });
  }
}
