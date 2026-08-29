import path from "node:path";
import { ProtocolError } from "@learn-by-diff/protocol";
import * as vscode from "vscode";
import type { GitClient } from "../git/client.ts";
import { GitError } from "../git/errors.ts";
import { openChapterFileDiff, openEntryFile } from "../ui/diff.ts";
import type { CourseTreeItem, CourseTreeProvider } from "../ui/explorerView.ts";
import { createLearningWorkspace } from "../workspace/creator.ts";
import { DirtyWorkspaceError } from "../workspace/errors.ts";
import {
  isInPlaceLearningTarget,
  loadLearningSession,
  type LearningSession,
} from "../workspace/loader.ts";
import { demoCoursePath } from "../workspace/resolveRepo.ts";
import { nextChapter, previousChapter, switchToChapter } from "../workspace/session.ts";

/**
 * Registers commands and wires them to the current workspace folder.
 *
 * @param context - Extension context
 * @param git - Git CLI client
 * @param tree - Explorer tree provider
 * @param setSession - Updates tree + status bar
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  git: GitClient,
  tree: CourseTreeProvider,
  setSession: (session: LearningSession | undefined) => void,
): void {
  const output = vscode.window.createOutputChannel("LearnByDiff");
  context.subscriptions.push(output);
  const isDevHost = context.extensionMode === vscode.ExtensionMode.Development;
  const defaultCourseUrl = isDevHost ? demoCoursePath(context.extensionPath) : undefined;

  /**
   * Returns the first workspace folder path, if any.
   */
  function workspaceRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  /**
   * Reloads `.learn` state for the open folder into the UI.
   */
  async function restore(): Promise<LearningSession | undefined> {
    const root = workspaceRoot();
    if (root === undefined) {
      setSession(undefined);
      return undefined;
    }
    try {
      const session = await loadLearningSession(root);
      setSession(session);
      return session;
    } catch (error) {
      setSession(undefined);
      showError(error);
      return undefined;
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("learnByDiff.openCourse", async () => {
      const url = await vscode.window.showInputBox({
        title: "LearnByDiff: Open Course",
        prompt: isDevHost
          ? "Course repository URL (prefilled with local examples/demo-course)"
          : "Course repository URL (must contain .course-config/course.yml)",
        placeHolder: "https://github.com/org/course.git",
        value: defaultCourseUrl,
        ignoreFocusOut: true,
      });
      if (url === undefined || url.trim() === "") {
        return;
      }

      const root = workspaceRoot();
      let inPlaceRoot: string | undefined;
      let parentDir: string | undefined;
      if (root !== undefined && (await isInPlaceLearningTarget(root))) {
        inPlaceRoot = root;
      } else {
        const picked = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          openLabel: "Create learning workspace here",
          title: "Parent folder for the learning workspace",
        });
        parentDir = picked?.[0]?.fsPath;
        if (parentDir === undefined) {
          return;
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
              courseRepoUrl: url.trim(),
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
        return;
      }

      const current = workspaceRoot();
      if (current !== undefined && path.resolve(current) === path.resolve(learningRoot)) {
        await restore();
        return;
      }
      await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(learningRoot));
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("learnByDiff.nextChapter", async () => {
      const session = await loadFromRoot();
      if (session === undefined) {
        return;
      }
      const next = nextChapter(session);
      if (next === undefined) {
        void vscode.window.showInformationMessage("This is the last chapter.");
        return;
      }
      await applyChapterSwitch(session, next.id);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("learnByDiff.previousChapter", async () => {
      const session = await loadFromRoot();
      if (session === undefined) {
        return;
      }
      const previous = previousChapter(session);
      if (previous === undefined) {
        void vscode.window.showInformationMessage("This is the first chapter.");
        return;
      }
      await applyChapterSwitch(session, previous.id);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("learnByDiff.goToChapter", async (item?: CourseTreeItem) => {
      const chapterId = item?.chapterId;
      if (chapterId === undefined || chapterId === "") {
        return;
      }
      const session = await loadFromRoot();
      if (session === undefined) {
        return;
      }
      if (session.progress.chapter === chapterId) {
        await openEntryFile(git, session);
        await tree.revealCurrentChapter();
        return;
      }
      const exists = session.course.chapters.some((chapter) => chapter.id === chapterId);
      if (!exists) {
        void vscode.window.showWarningMessage(`Unknown chapter: ${chapterId}`);
        return;
      }
      await applyChapterSwitch(session, chapterId);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("learnByDiff.openFileDiff", async (item?: CourseTreeItem) => {
      if (item?.kind !== "file" || item.relativePath === undefined) {
        return;
      }
      // Use loadFromRoot (not restore): restore refreshes the tree + re-selects the
      // chapter, which flashes selection when opening a file diff.
      const session = await loadFromRoot();
      if (session === undefined) {
        return;
      }
      try {
        // Click selects the row; clear before slow archive work so it never stays highlighted.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        await tree.clearSelection();
        await openChapterFileDiff(git, session, item.chapterId, item.relativePath);
      } catch (error) {
        showError(error);
      } finally {
        await tree.clearSelection();
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("learnByDiff.viewAsTree", async () => {
      await tree.setViewMode("tree");
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("learnByDiff.viewAsList", async () => {
      await tree.setViewMode("list");
    }),
  );

  /**
   * Loads a session from the open folder without resetting UI on failure.
   */
  async function loadFromRoot(): Promise<LearningSession | undefined> {
    const root = workspaceRoot();
    if (root === undefined) {
      void vscode.window.showWarningMessage("Open a folder first.");
      return undefined;
    }
    const session = await loadLearningSession(root);
    if (session === undefined) {
      void vscode.window.showWarningMessage("This folder is not a LearnByDiff learning workspace.");
    }
    return session;
  }

  /**
   * Switches chapter after an optional QuickPick confirmation, then opens the entry file.
   */
  async function applyChapterSwitch(session: LearningSession, chapterId: string): Promise<void> {
    try {
      await switchToChapter(git, session, chapterId, false);
    } catch (error) {
      if (error instanceof DirtyWorkspaceError) {
        const chapter = session.course.chapters.find((item) => item.id === chapterId);
        const label = chapter?.title ?? chapterId;
        const pick = await vscode.window.showQuickPick(
          [
            {
              label: "Switch Chapter",
              description: `Replace working files with “${label}” start`,
            },
            {
              label: "Keep Editing",
              description: "Stay on the current chapter",
            },
          ],
          {
            title: `Switch to “${label}”?`,
            placeHolder: "Your edits since this chapter’s start will be discarded",
            ignoreFocusOut: true,
          },
        );
        if (pick?.label !== "Switch Chapter") {
          return;
        }
        await switchToChapter(git, session, chapterId, true);
      } else {
        showError(error);
        return;
      }
    }
    setSession(session);
    await openEntryFile(git, session);
    await tree.revealCurrentChapter();
  }

  void restore();
}

/**
 * Shows a Git or generic error in a message box.
 *
 * @param error - Thrown value
 */
function showError(error: unknown): void {
  if (error instanceof GitError || error instanceof ProtocolError) {
    void vscode.window.showErrorMessage(error.message);
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  void vscode.window.showErrorMessage(message);
}
