import * as vscode from "vscode";
import type { GitClient } from "../git/client.ts";
import { openChapterFileDiff, openEntryFile } from "../ui/diff.ts";
import type { CourseTreeItem, CourseTreeProvider } from "../ui/explorerView.ts";
import { openChapterDocs } from "../ui/openDocs.ts";
import { DirtyWorkspaceError } from "../workspace/errors.ts";
import { loadLearningSession, type LearningSession } from "../workspace/loader.ts";
import { openCourse } from "../workspace/openCourse.ts";
import { demoCoursePath } from "../workspace/resolveRepo.ts";
import { nextChapter, previousChapter, switchToChapter } from "../workspace/session.ts";
import { registerUriHandler } from "../uri/registerUriHandler.ts";
import { showError } from "./showError.ts";

/**
 * Registers commands, deep-link URI handler, and wires them to the open folder.
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

  registerUriHandler(context, git, output, setSession);

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

      await openCourse({
        courseRepoUrl: url.trim(),
        git,
        output,
        onSession: setSession,
      });
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
    vscode.commands.registerCommand(
      "learnByDiff.openChapterDocs",
      async (item?: CourseTreeItem) => {
        const chapterId = item?.chapterId;
        if (chapterId === undefined || chapterId === "") {
          return;
        }
        const session = await loadFromRoot();
        if (session === undefined) {
          return;
        }
        try {
          await openChapterDocs(session, chapterId);
        } catch (error) {
          showError(error);
        }
      },
    ),
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
