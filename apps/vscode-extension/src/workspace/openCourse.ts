import { ProtocolError } from "@learn-by-diff/protocol";
import path from "node:path";
import * as vscode from "vscode";
import type { GitClient } from "../git/client.ts";
import { createLearningWorkspace } from "./creator.ts";
import {
  findLearningWorkspaceRoot,
  isInPlaceLearningTarget,
  loadLearningSession,
  type LearningSession,
} from "./loader.ts";
import { showError } from "../commands/showError.ts";

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
 * Creates a learning workspace from a course URL and opens the folder when needed.
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
    const picked = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: "Create learning workspace here",
      title: "Parent folder for the learning workspace",
    });
    parentDir = picked?.[0]?.fsPath;
    if (parentDir === undefined) {
      return undefined;
    }
  }

  let learningRoot: string | undefined;
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "LearnByDiff: opening course",
      cancellable: false,
    },
    async () => {
      try {
        const created = await createLearningWorkspace({
          courseRepoUrl: url,
          inPlaceRoot,
          parentDir,
          git,
          onLog: (line) => output.appendLine(line),
        });
        learningRoot = created.learningRoot;
      } catch (error) {
        if (error instanceof ProtocolError) {
          void vscode.window.showErrorMessage(
            `This repository has no valid Learning Course Protocol config.\n${error.message}`,
          );
          return;
        }
        showError(error);
      }
    },
  );

  if (learningRoot === undefined) {
    return undefined;
  }

  const alreadyOpen = await findLearningWorkspaceRoot(folderPaths);
  if (alreadyOpen !== undefined && path.resolve(alreadyOpen) === path.resolve(learningRoot)) {
    try {
      const session = await loadLearningSession(learningRoot);
      onSession?.(session);
    } catch (error) {
      onSession?.(undefined);
      showError(error);
    }
    return learningRoot;
  }

  await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(learningRoot));
  return learningRoot;
}
