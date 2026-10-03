import { loadCourseFromConfigDir } from "@learn-by-diff/protocol";
import * as vscode from "vscode";
import { showError } from "../commands/showError.ts";
import type { GitClient } from "../git/client.ts";
import { fetchRemoteText } from "./officialCourses.ts";
import { installCourseSourceAndFirstChapter } from "./creator.ts";
import { loadLearningSession, type LearningSession } from "./loader.ts";
import path from "node:path";
import { learningPaths } from "./paths.ts";
import {
  downloadChapterConfigFiles,
  readChapterConfigDownloadRecord,
  removeChapterConfigDownloadRecord,
} from "./chapterConfigDownload.ts";

/** Options for finishing a remote course whose chapter JSONC is still pending. */
export interface ResumeChapterConfigDownloadOptions {
  git: GitClient;
  workspaceRoot: string;
  /** Optional logger. */
  onLog?: (line: string) => void;
  /** Called with the loaded session after chapter 1 is exported. */
  onReady?: (session: LearningSession) => void;
}

/** Learning root whose chapter-config download is already running. */
let runningRoot: string | undefined;

/**
 * Downloads pending chapter JSONC files, deletes that record, then exports chapter 1.
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
 * Shows a notification while chapter JSONC files download, then continues course setup.
 *
 * Keeps the pending record when the download fails so a later open can retry.
 *
 * @param options - Workspace and completion callback
 */
async function runResume(options: ResumeChapterConfigDownloadOptions): Promise<void> {
  const record = await readChapterConfigDownloadRecord(options.workspaceRoot);
  if (record === undefined) {
    return;
  }

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: vscode.l10n.t("LearnByDiff: downloading chapter config"),
        cancellable: false,
      },
      downloadConfigs,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    options.onLog?.(`Chapter config download failed: ${message}`);
    showError(error);
    return;
  }

  try {
    const { courseDir } = learningPaths(options.workspaceRoot);
    const course = await loadCourseFromConfigDir(courseDir);
    await installCourseSourceAndFirstChapter(
      options.git,
      options.workspaceRoot,
      course,
      courseDir,
      options.onLog,
    );
    const session = await loadLearningSession(options.workspaceRoot);
    if (session !== undefined) {
      options.onReady?.(session);
    }
  } catch (error) {
    showError(error);
  }

  /**
   * Writes chapter JSONC files next to `course.jsonc` and deletes the pending record.
   */
  async function downloadConfigs(): Promise<void> {
    if (record === undefined) {
      return;
    }
    const destination = path.join(
      learningPaths(options.workspaceRoot).courseDir,
      ...record.chaptersDir.split("/").filter((segment) => segment !== ""),
    );
    await downloadChapterConfigFiles(record, destination, fetchGithubJson, fetchRemoteText);
    await removeChapterConfigDownloadRecord(options.workspaceRoot);
  }
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
