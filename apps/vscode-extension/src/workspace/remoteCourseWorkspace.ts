import { COURSE_FILE_NAME, parseCourseJsonc } from "@learn-by-diff/protocol";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GitClient } from "../git/client.ts";
import {
  chapterConfigDownloadRecordFromCourse,
  writeChapterConfigDownloadRecord,
} from "./chapterConfigDownload.ts";
import { describeCourseOrigin, writeCourseOrigin } from "./courseOrigin.ts";
import { ensureLearningWorkspaceFile } from "./multiRoot.ts";
import { isEmptyLearningTarget } from "./emptyTarget.ts";
import { NonEmptyLearningTargetError } from "./errors.ts";
import { learningPaths } from "./paths.ts";
import { ensureBuiltinRetain } from "./retain.ts";

/** Options for creating a learning folder from a downloaded `course.jsonc` only. */
export interface PrepareRemoteCourseWorkspaceOptions {
  /** GitHub `course.jsonc` URL the student confirmed. */
  courseRepoUrl: string;
  /** Raw `course.jsonc` downloaded while the Open Course picker stayed open. */
  courseJsoncText: string;
  git: GitClient;
  /** Initialize this folder in place when it is empty. */
  inPlaceRoot?: string;
  /** Parent directory; workspace becomes `{parent}/{course.id}`. */
  parentDir?: string;
  /** Optional logger. */
  onLog?: (line: string) => void;
}

/**
 * Creates a learning folder from a downloaded `course.jsonc` without chapter JSONC files.
 *
 * Writes `.learn/chapter-config-download.json` with `completed: false`. That file is
 * removed after the chapter files download. Source snapshots are not copied here.
 *
 * @param options - Downloaded course config and destination
 * @returns Absolute learning root
 */
export async function prepareRemoteCourseWorkspace(
  options: PrepareRemoteCourseWorkspaceOptions,
): Promise<string> {
  const { courseRepoUrl, courseJsoncText, git, onLog, inPlaceRoot, parentDir } = options;
  await git.ensureAvailable();

  const record = chapterConfigDownloadRecordFromCourse(courseRepoUrl, courseJsoncText);
  if (record === undefined) {
    throw new Error(`course.jsonc URL is not a GitHub file: ${courseRepoUrl}`);
  }
  const parsed = parseCourseJsonc(courseJsoncText, COURSE_FILE_NAME);
  const id = parsed.id.trim() || record.repo;
  const learningRoot =
    inPlaceRoot ?? (parentDir !== undefined ? path.join(parentDir, id) : undefined);
  if (learningRoot === undefined) {
    throw new Error("prepareRemoteCourseWorkspace requires inPlaceRoot or parentDir");
  }
  if (!(await isEmptyLearningTarget(learningRoot))) {
    throw new NonEmptyLearningTargetError(learningRoot);
  }

  await mkdir(learningRoot, { recursive: true });
  const paths = learningPaths(learningRoot);
  await mkdir(paths.courseDir, { recursive: true });
  await rm(path.join(paths.courseDir, COURSE_FILE_NAME), { force: true });
  await writeFile(path.join(paths.courseDir, COURSE_FILE_NAME), courseJsoncText, "utf8");
  await ensureBuiltinRetain(paths.courseDir);
  await writeChapterConfigDownloadRecord(learningRoot, record);
  await writeCourseOrigin(
    learningRoot,
    await describeCourseOrigin(git, courseRepoUrl, paths.courseDir),
  );
  await ensureLearningWorkspaceFile(learningRoot);
  onLog?.("Downloaded course.jsonc. Chapter config files download after the workspace opens.");
  return learningRoot;
}
