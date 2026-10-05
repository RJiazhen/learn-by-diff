import {
  applyCourseDefaults,
  COURSE_FILE_NAME,
  parseChapterJsonc,
  parseCourseJsonc,
  validateCourse,
  type ChapterConfig,
  type Course,
} from "@learn-by-diff/protocol";
import { readFile } from "node:fs/promises";
import path from "node:path";
import * as vscode from "vscode";
import { showError } from "../commands/showError.ts";
import type { GitClient } from "../git/client.ts";
import { discardSourceCloneIfSnapshotsReady, writeChapterArchives } from "../snapshot/archive.ts";
import { fetchRemoteText } from "./officialCourses.ts";
import { applyFirstChapterStart, materializeCourseSource } from "./creator.ts";
import { type LearningSession } from "./loader.ts";
import { learningPaths } from "./paths.ts";
import { ensureBuiltinRetain } from "./retain.ts";
import { readProgress } from "./state.ts";
import {
  downloadChapterConfigFiles,
  readChapterConfigDownloadRecord,
  removeChapterConfigDownloadRecord,
} from "./chapterConfigDownload.ts";
import { nextRevealChapterFiles } from "./chapterRevealOrder.ts";

/** Options for finishing a remote course whose chapter JSONC is still pending. */
export interface ResumeChapterConfigDownloadOptions {
  git: GitClient;
  workspaceRoot: string;
  /** Optional logger. */
  onLog?: (line: string) => void;
  /**
   * Called each time the set of finished chapters grows enough to update the tree.
   * Chapter 1 always appears in the first call.
   */
  onChapterReady?: (session: LearningSession) => void;
  /** Called once after every chapter config and snapshot has finished. */
  onReady?: (session: LearningSession) => void;
}

/** Learning root whose chapter-config download is already running. */
let runningRoot: string | undefined;

/**
 * Downloads pending chapter JSONC files, caches each chapter's snapshots, then
 * reveals rows as chapters finish (chapter 1 first).
 *
 * Returns immediately. A second call for the same root does nothing while the first
 * run is in progress. The Open Course picker does not stay open for this download.
 *
 * @param options - Workspace that has `.learn/chapter-config-download.json`
 */
export function resumeChapterConfigDownload(options: ResumeChapterConfigDownloadOptions): void {
  if (runningRoot === options.workspaceRoot) {
    return;
  }
  runningRoot = options.workspaceRoot;
  void setDownloadingChapterConfig(true);
  void runResume(options).finally(finishResume);

  /**
   * Clears the in-flight handle and hides the Learn By Diff tip when this root finishes.
   */
  function finishResume(): void {
    if (runningRoot === options.workspaceRoot) {
      runningRoot = undefined;
    }
    void setDownloadingChapterConfig(false);
  }
}

/**
 * Shows or hides the Learn By Diff tip while chapter JSONC is downloading.
 *
 * @param downloading - Whether a chapter-config download is in progress
 */
async function setDownloadingChapterConfig(downloading: boolean): Promise<void> {
  await vscode.commands.executeCommand(
    "setContext",
    "learnByDiff.downloadingChapterConfig",
    downloading,
  );
}

/**
 * Downloads chapter configs in parallel, snapshots each chapter as its config
 * arrives, and reveals finished chapters with chapter 1 shown first.
 *
 * Keeps the pending record when the download fails so a later open can retry.
 *
 * @param options - Workspace and completion callbacks
 */
async function runResume(options: ResumeChapterConfigDownloadOptions): Promise<void> {
  const pending = await readChapterConfigDownloadRecord(options.workspaceRoot);
  if (pending === undefined) {
    return;
  }
  const record = pending;

  const { courseDir, sourceMirror } = learningPaths(options.workspaceRoot);
  const chaptersDir = path.join(
    courseDir,
    ...record.chaptersDir.split("/").filter((segment) => segment !== ""),
  );
  const finishedFiles = new Set<string>();
  let sortedNames: string[] = [];
  let firstChapterApplied = false;
  /** How many chapter rows have been pushed to the UI so far. */
  let revealedCount = 0;
  let revealTail: Promise<void> = Promise.resolve();

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: vscode.l10n.t("LearnByDiff: downloading course"),
        cancellable: false,
      },
      runDownloadAndSnapshots,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    options.onLog?.(`Chapter config download failed: ${message}`);
    showError(error);
    return;
  }

  try {
    await revealTail;
    const session = await loadFinishedSession(
      options.workspaceRoot,
      courseDir,
      record.chaptersDir,
      sortedNames.filter((name) => finishedFiles.has(name)),
    );
    if (session !== undefined) {
      options.onReady?.(session);
    }
  } catch (error) {
    showError(error);
  }

  /**
   * Materializes source alongside chapter-1 download, then snapshots each finished config.
   *
   * Chapter 1's config is fetched first (full bandwidth). Remaining configs download in
   * parallel while chapter 1's snapshots (and later rows) can already proceed.
   */
  async function runDownloadAndSnapshots(): Promise<void> {
    await ensureBuiltinRetain(courseDir);
    const courseStub = await loadCourseConfigStub(courseDir);
    const sourceReady = materializeCourseSource(
      options.git,
      options.workspaceRoot,
      courseStub,
      courseDir,
      options.onLog,
    );

    await downloadChapterConfigFiles(record, chaptersDir, fetchGithubJson, fetchRemoteText, {
      /**
       * Records sorted chapter file names before downloads start.
       *
       * @param names - Chapter JSONC basenames in course order
       */
      onChapterNames: (names) => {
        sortedNames = [...names];
      },
      /**
       * Waits for the source store, caches that chapter's snapshots, then queues a reveal.
       *
       * @param fileName - Chapter JSONC basename just written
       */
      onChapterFile: async (fileName) => {
        await sourceReady;
        await snapshotChapterFile(fileName);
        finishedFiles.add(fileName);
        await queueReveal();
      },
    });
    await sourceReady;
    if (sortedNames.length > 0) {
      const course = await loadCourseFromChapterFiles(courseDir, record.chaptersDir, sortedNames);
      await discardSourceCloneIfSnapshotsReady(options.workspaceRoot, course);
    }
    await removeChapterConfigDownloadRecord(options.workspaceRoot);
  }

  /**
   * Exports from/to snapshots for the chapter defined by `fileName`.
   *
   * @param fileName - Chapter JSONC basename
   */
  async function snapshotChapterFile(fileName: string): Promise<void> {
    const course = await loadCourseFromChapterFiles(courseDir, record.chaptersDir, [fileName]);
    const chapter = course.chapters[0];
    if (chapter === undefined) {
      throw new Error(`chapter config file has no chapter: ${fileName}`);
    }
    options.onLog?.(`Caching snapshots for chapter ${chapter.id}…`);
    await writeChapterArchives(
      options.git,
      sourceMirror,
      options.workspaceRoot,
      chapter.fromDir,
      chapter.toDir,
      course.config.source,
    );
  }

  /**
   * Serializes tree updates so overlapping chapter completions cannot race `setSession`.
   */
  function queueReveal(): Promise<void> {
    /**
     * Reveals finished chapters once chapter 1 is ready.
     */
    const run = async (): Promise<void> => {
      await revealFinishedChapters();
    };
    const next = revealTail.then(run, run);
    revealTail = next.then(
      /**
       * Keeps the reveal queue alive after a successful reveal.
       */
      () => undefined,
      /**
       * Keeps the reveal queue alive after a failed reveal.
       */
      () => undefined,
    );
    return next;
  }

  /**
   * Reveals finished chapters one row at a time so the tree follows download progress.
   *
   * Chapter 1 is always first. Chapters that finish earlier stay buffered until then,
   * then appear one-by-one (with a turn between updates so the view can paint).
   */
  async function revealFinishedChapters(): Promise<void> {
    for (;;) {
      const visibleNames = nextRevealChapterFiles(sortedNames, finishedFiles, revealedCount);
      if (visibleNames === undefined) {
        return;
      }
      const course = await loadCourseFromChapterFiles(courseDir, record.chaptersDir, visibleNames);
      if (!firstChapterApplied) {
        await applyFirstChapterStart(options.git, options.workspaceRoot, course, options.onLog);
        firstChapterApplied = true;
      }
      const session = await sessionFromCourse(options.workspaceRoot, course);
      if (session !== undefined) {
        options.onChapterReady?.(session);
      }
      revealedCount = visibleNames.length;
      // Let the tree paint before adding the next already-finished chapter.
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    }
  }
}

/**
 * Loads a session whose course includes only the given finished chapter files.
 *
 * @param workspaceRoot - Learning workspace root
 * @param courseDir - `.learn/course` directory
 * @param chaptersDirRel - Chapters directory relative to `courseDir`
 * @param fileNames - Finished chapter JSONC basenames in course order
 */
async function loadFinishedSession(
  workspaceRoot: string,
  courseDir: string,
  chaptersDirRel: string,
  fileNames: string[],
): Promise<LearningSession | undefined> {
  if (fileNames.length === 0) {
    return undefined;
  }
  const course = await loadCourseFromChapterFiles(courseDir, chaptersDirRel, fileNames);
  return sessionFromCourse(workspaceRoot, course);
}

/**
 * Builds a {@link LearningSession} from an already-loaded course and on-disk progress.
 *
 * @param workspaceRoot - Learning workspace root
 * @param course - Course with only finished chapters
 */
async function sessionFromCourse(
  workspaceRoot: string,
  course: Course,
): Promise<LearningSession | undefined> {
  const progress = await readProgress(workspaceRoot);
  if (progress === undefined) {
    return undefined;
  }
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
 * Loads `course.jsonc` defaults without requiring chapter files (source materialize only).
 *
 * @param courseDir - Directory that contains `course.jsonc`
 */
async function loadCourseConfigStub(courseDir: string): Promise<Course> {
  const courseRel = COURSE_FILE_NAME;
  const courseText = await readFile(path.join(courseDir, COURSE_FILE_NAME), "utf8");
  const parsed = parseCourseJsonc(courseText, courseRel);
  const config = applyCourseDefaults(parsed, courseDir);
  return { config, chapters: [], configDir: courseDir };
}

/**
 * Builds a validated course from `course.jsonc` plus selected chapter JSONC files.
 *
 * @param courseDir - Directory that contains `course.jsonc`
 * @param chaptersDirRel - Chapters directory relative to `courseDir`
 * @param fileNames - Chapter JSONC basenames to include (already sorted)
 */
async function loadCourseFromChapterFiles(
  courseDir: string,
  chaptersDirRel: string,
  fileNames: string[],
): Promise<Course> {
  const courseText = await readFile(path.join(courseDir, COURSE_FILE_NAME), "utf8");
  const parsed = parseCourseJsonc(courseText, COURSE_FILE_NAME);
  const config = applyCourseDefaults(parsed, courseDir);
  const chaptersAbs = path.join(
    courseDir,
    ...chaptersDirRel.split("/").filter((segment) => segment !== ""),
  );
  const chapters: ChapterConfig[] = [];
  for (const name of fileNames) {
    const relativePath = `${chaptersDirRel}/${name}`;
    const text = await readFile(path.join(chaptersAbs, name), "utf8");
    chapters.push(parseChapterJsonc(text, relativePath, name));
  }
  return validateCourse(config, chapters, courseDir);
}

/**
 * Reads a GitHub JSON URL.
 *
 * @param url - Contents API URL
 */
async function fetchGithubJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "learn-by-diff",
    },
  });
  if (!response.ok) {
    throw new Error(`Could not list chapter config files: ${response.status}`);
  }
  return await response.json();
}
