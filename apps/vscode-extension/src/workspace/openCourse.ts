import { ProtocolError } from "@learn-by-diff/protocol";
import * as vscode from "vscode";
import type { GitClient } from "../git/client.ts";
import { showError } from "../commands/showError.ts";
import {
  startBackgroundSnapshotPrefetch,
  type SnapshotPrefetchProgress,
} from "../snapshot/prefetch.ts";
import { reportSnapshotPrefetchProgress } from "../snapshot/prefetchProgress.ts";
import { createLearningWorkspace } from "./creator.ts";
import { NonEmptyLearningTargetError } from "./errors.ts";
import {
  findLearningWorkspaceRoot,
  isInPlaceLearningTarget,
  loadLearningSession,
  type LearningSession,
} from "./loader.ts";
import { openLearningWorkspaceIfNeeded } from "./workspaceFolders.ts";

/** Options for opening a course into a learning workspace. */
export interface OpenCourseOptions {
  courseRepoUrl: string;
  git: GitClient;
  output: vscode.OutputChannel;
  /**
   * When set, skip the folder picker and use this parent (or in-place root rules still apply).
   */
  parentDir?: string;
  /** Updates UI after an in-place open. */
  onSession?: (session: LearningSession | undefined) => void;
}

/**
 * Creates a learning workspace from a `course.jsonc` path, GitHub file URL, or git URL,
 * opens that folder, then caches every unique chapter snapshot in the background.
 *
 * The folder opens before that cache. A host reload resumes any trees still missing.
 *
 * Shared by the command palette flow and browser / OS deep links.
 *
 * @param options - Course URL, git client, and optional parent directory
 * @returns Absolute learning root when created; `undefined` when cancelled or failed
 */
export async function openCourse(options: OpenCourseOptions): Promise<string | undefined> {
  const { courseRepoUrl, git, output, onSession } = options;
  const url = courseRepoUrl.trim();
  if (url === "") {
    return undefined;
  }

  const folderPaths = (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath);
  const root =
    (await findLearningWorkspaceRoot(folderPaths)) ??
    (folderPaths.length > 0 ? folderPaths[0] : undefined);
  let inPlaceRoot: string | undefined;
  let parentDir = options.parentDir;

  if (root !== undefined && (await isInPlaceLearningTarget(root))) {
    inPlaceRoot = root;
    parentDir = undefined;
  } else if (parentDir === undefined || parentDir.trim() === "") {
    parentDir = await pickLearningWorkspaceParent();
    if (parentDir === undefined) {
      return undefined;
    }
  }

  let learningRoot: string | undefined;
  for (;;) {
    let blockedRoot: string | undefined;
    /**
     * Creates the learning workspace.
     *
     * This notification ends before the folder opens. Snapshot caching starts
     * after the folder is open and does not hold it.
     *
     * @param progress - Opening-course progress reporter
     */
    async function createWorkspace(
      progress: vscode.Progress<{ message?: string; increment?: number }>,
    ): Promise<void> {
      /**
       * Logs a clone/materialize line and shows it on the progress notification.
       *
       * @param line - Message from workspace creation
       */
      const onCreateLog = (line: string): void => {
        output.appendLine(line);
        progress.report({ message: line });
      };
      try {
        const created = await createLearningWorkspace({
          courseRepoUrl: url,
          inPlaceRoot,
          parentDir,
          git,
          onLog: onCreateLog,
        });
        learningRoot = created.learningRoot;
      } catch (error) {
        if (error instanceof NonEmptyLearningTargetError) {
          blockedRoot = error.learningRoot;
          return;
        }
        if (error instanceof ProtocolError) {
          void vscode.window.showErrorMessage(
            vscode.l10n.t(
              "This repository has no valid Learning Course Protocol config.\n{0}",
              error.message,
            ),
          );
          return;
        }
        showError(error);
      }
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: vscode.l10n.t("LearnByDiff: opening course"),
        cancellable: false,
      },
      createWorkspace,
    );

    if (learningRoot !== undefined) {
      break;
    }
    if (blockedRoot === undefined) {
      return undefined;
    }

    await vscode.window.showWarningMessage(
      vscode.l10n.t(
        "The folder “{0}” is not empty. Open Course will not overwrite existing files. Choose another parent folder.",
        blockedRoot,
      ),
      { modal: true },
    );
    inPlaceRoot = undefined;
    parentDir = await pickLearningWorkspaceParent();
    if (parentDir === undefined) {
      return undefined;
    }
  }

  const switched = await openLearningWorkspaceIfNeeded(learningRoot);

  try {
    const session = await loadLearningSession(learningRoot);
    if (session !== undefined) {
      cacheAllChapterSnapshots(git, output, session);
    }
    if (!switched) {
      onSession?.(session);
    }
  } catch (error) {
    if (!switched) {
      onSession?.(undefined);
    }
    showError(error);
  }
  return learningRoot;
}

/**
 * Caches every unique chapter snapshot after the learning folder is open.
 *
 * Returns immediately. The copy continues in the background and is skipped when
 * a cache for this workspace is already running.
 *
 * @param git - Git client
 * @param output - LearnByDiff output channel
 * @param session - Loaded learning session
 */
function cacheAllChapterSnapshots(
  git: GitClient,
  output: vscode.OutputChannel,
  session: LearningSession,
): void {
  startBackgroundSnapshotPrefetch(git, session, {
    onLog: appendSnapshotCacheLog,
    runProgress: showSnapshotCacheProgress,
  });

  /**
   * Appends a snapshot-cache log line to the LearnByDiff output channel.
   *
   * @param line - Message from snapshot prefetch
   */
  function appendSnapshotCacheLog(line: string): void {
    output.appendLine(line);
  }
}

/**
 * Shows snapshot-cache progress after the course folder is already open.
 *
 * @param work - Prefetch body that reports per-tree progress
 * @param abort - Controller cancelled when the extension deactivates
 */
async function showSnapshotCacheProgress(
  work: (
    onProgress: (progress: SnapshotPrefetchProgress) => void,
    signal: AbortSignal,
  ) => Promise<void>,
  abort: AbortController,
): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: vscode.l10n.t("LearnByDiff: caching snapshots"),
      cancellable: false,
    },
    reportSnapshotCache,
  );

  /**
   * Updates the cache notification as each unique source tree is written.
   *
   * @param progress - VS Code progress reporter
   */
  function reportSnapshotCache(
    progress: vscode.Progress<{ message?: string; increment?: number }>,
  ): Promise<void> {
    /**
     * Forwards one tree's progress into the notification.
     *
     * @param info - Trees completed, total, and the subtree just written
     */
    const onProgress = (info: SnapshotPrefetchProgress): void => {
      reportSnapshotPrefetchProgress(progress, info);
    };
    return work(onProgress, abort.signal);
  }
}

/**
 * Asks the user to pick a parent folder for a new learning workspace.
 *
 * @returns Absolute path, or `undefined` when the picker is cancelled
 */
async function pickLearningWorkspaceParent(): Promise<string | undefined> {
  const picked = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: vscode.l10n.t("Create learning workspace here"),
    title: vscode.l10n.t("Parent folder for the learning workspace"),
  });
  return picked?.[0]?.fsPath;
}
