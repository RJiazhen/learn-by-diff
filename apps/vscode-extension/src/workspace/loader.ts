import { readdir, stat } from "node:fs/promises";
import { isCourseRepository, loadCourseFromConfigDir, type Course } from "@learn-by-diff/protocol";
import { learningPaths } from "./paths.ts";
import { readProgress, type LearningProgress } from "./state.ts";

/** Loaded learning session: course copy plus progress. */
export interface LearningSession {
  course: Course;
  progress: LearningProgress;
  workspaceRoot: string;
}

/**
 * Returns whether `workspaceRoot` is a learning workspace (has `.learn/progress.json`).
 *
 * Course repositories with only `.course-config` are not treated as learning sessions.
 *
 * @param workspaceRoot - Folder currently open
 */
export async function isLearningWorkspace(workspaceRoot: string): Promise<boolean> {
  if (await isCourseRepository(workspaceRoot)) {
    return false;
  }
  const progress = await readProgress(workspaceRoot);
  return progress !== undefined;
}

/**
 * Loads course config from `.learn/course` and progress from `.learn/progress.json`.
 *
 * Missing `appliedSide` is treated as `start`. Older `appliedStart` (when it differs
 * from `chapter`) is used as the applied chapter so the badge matches files on disk.
 *
 * @param workspaceRoot - Learning repository root
 */
export async function loadLearningSession(
  workspaceRoot: string,
): Promise<LearningSession | undefined> {
  if (!(await isLearningWorkspace(workspaceRoot))) {
    return undefined;
  }
  const progress = await readProgress(workspaceRoot);
  if (progress === undefined) {
    return undefined;
  }
  const course = await loadCourseFromConfigDir(learningPaths(workspaceRoot).courseDir);
  return {
    course,
    progress: {
      chapter: progress.appliedStart ?? progress.chapter,
      completed: progress.completed,
      appliedSide: progress.appliedSide === "finish" ? "finish" : "start",
    },
    workspaceRoot,
  };
}

/**
 * Returns whether `dir` can be initialized in place (empty except README / dotfiles).
 *
 * Used so F5 sandbox does not nest `sandbox/{course-id}/`.
 *
 * @param dir - Candidate learning root
 */
export async function isInPlaceLearningTarget(dir: string): Promise<boolean> {
  if (await isLearningWorkspace(dir)) {
    return true;
  }
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return false;
  }
  const meaningful = [];
  for (const name of entries) {
    if (name.startsWith(".")) {
      continue;
    }
    if (name === "README.md") {
      continue;
    }
    meaningful.push(name);
  }
  if (meaningful.length > 0) {
    return false;
  }
  try {
    return (await stat(dir)).isDirectory();
  } catch {
    return false;
  }
}
