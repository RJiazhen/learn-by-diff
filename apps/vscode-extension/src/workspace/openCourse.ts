import { ProtocolError } from "@learn-by-diff/protocol";
import * as vscode from "vscode";
import type { GitClient } from "../git/client.ts";
import {
  prefetchAllChapterSnapshots,
  type SnapshotPrefetchProgress,
} from "../snapshot/prefetch.ts";
import { reportSnapshotPrefetchProgress } from "../snapshot/prefetchProgress.ts";
import { showError } from "../commands/showError.ts";
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
 * Creates a learning workspace from a `course.yml` path, GitHub file URL, or git URL,
 * caches unique chapter snapshots, and opens the folder when needed.
 *
 * Snapshot download uses the same progress notification as workspace creation.
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
     * Creates the learning workspace and caches unique chapter snapshots in one notification.
     *
     * @param progress - Opening-course progress reporter
     */
    async function createWorkspaceAndPrefetchSnapshots(
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
      /**
       * Appends a prefetch log line to the LearnByDiff output channel.
       *
       * @param line - Message from snapshot prefetch
       */
      const onPrefetchLog = (line: string): void => {
        output.appendLine(line);
      };
      /**
       * Updates the opening-course notification as each unique source tree is cached.
       *
       * @param info - Trees completed, total, and the subtree just written
       */
      const onPrefetchProgress = (info: SnapshotPrefetchProgress): void => {
        reportSnapshotPrefetchProgress(progress, info);
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
        const session = await loadLearningSession(created.learningRoot);
        if (session === undefined) {
          return;
        }
        await prefetchAllChapterSnapshots(git, session, {
          onLog: onPrefetchLog,
          onProgress: onPrefetchProgress,
        });
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
      createWorkspaceAndPrefetchSnapshots,
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
  if (switched) {
    return learningRoot;
  }

  try {
    const session = await loadLearningSession(learningRoot);
    onSession?.(session);
  } catch (error) {
    onSession?.(undefined);
    showError(error);
  }
  return learningRoot;
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
