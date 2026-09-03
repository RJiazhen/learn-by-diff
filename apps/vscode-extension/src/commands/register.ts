import * as vscode from "vscode";
import type { GitClient } from "../git/client.ts";
import { openChapterFileDiff } from "../ui/diff.ts";
import type { CourseTreeItem, CourseTreeProvider } from "../ui/explorerView.ts";
import { localizedSnapshotStatus } from "../ui/labels.ts";
import { openChapterDocs } from "../ui/openDocs.ts";
import { DirtyWorkspaceError } from "../workspace/errors.ts";
import {
  findLearningWorkspaceRoot,
  loadLearningSession,
  type LearningSession,
} from "../workspace/loader.ts";
import { openCourse } from "../workspace/openCourse.ts";
import { materializeChapterRef, chapterRefWorkspaceName } from "../workspace/refs.ts";
import { demoCoursePath } from "../workspace/resolveRepo.ts";
import { applyChapterSnapshot, nextChapter, previousChapter } from "../workspace/session.ts";
import type { ChapterSnapshotSide } from "../workspace/state.ts";
import {
  addOrOpenWorkspaceFolder,
  openLearningWorkspaceIfNeeded,
} from "../workspace/workspaceFolders.ts";
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
   * Returns the learning workspace folder path when one is open.
   *
   * Scans every Explorer root so chapter reference folders do not hide `.learn`.
   */
  async function workspaceRoot(): Promise<string | undefined> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    return findLearningWorkspaceRoot(folders.map((folder) => folder.uri.fsPath));
  }

  /**
   * Reloads `.learn` state for the open folder into the UI.
   *
   * Leaves `learnByDiff.ready` unset when the host is about to reload into the
   * learning workspace file, so Open Course does not flash during the switch.
   */
  async function restore(): Promise<LearningSession | undefined> {
    let awaitingHostReload = false;
    try {
      const root = await workspaceRoot();
      if (root === undefined) {
        setSession(undefined);
        return undefined;
      }
      try {
        if (await openLearningWorkspaceIfNeeded(root)) {
          awaitingHostReload = true;
          return undefined;
        }
        const session = await loadLearningSession(root);
        setSession(session);
        return session;
      } catch (error) {
        setSession(undefined);
        showError(error);
        return undefined;
      }
    } finally {
      if (!awaitingHostReload) {
        await vscode.commands.executeCommand("setContext", "learnByDiff.ready", true);
      }
    }
  }

  registerUriHandler(context, git, output, setSession);

  context.subscriptions.push(
    vscode.commands.registerCommand("learnByDiff.openCourse", async () => {
      const url = await vscode.window.showInputBox({
        title: vscode.l10n.t("LearnByDiff: Open Course"),
        prompt: isDevHost
          ? vscode.l10n.t(
              "Path to course.yml (prefilled with local examples/demo-course/.course-config/course.yml)",
            )
          : vscode.l10n.t("Path to course.yml, or a git URL to a course repository"),
        placeHolder: "/path/to/course.yml",
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
        void vscode.window.showInformationMessage(vscode.l10n.t("This is the last chapter."));
        return;
      }
      await applySnapshotWithConfirm(session, next.id, "start");
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
        void vscode.window.showInformationMessage(vscode.l10n.t("This is the first chapter."));
        return;
      }
      await applySnapshotWithConfirm(session, previous.id, "start");
    }),
  );

  /**
   * Applies the start snapshot for the chapter row the user clicked.
   *
   * @param item - Explorer chapter row
   */
  async function onApplyChapterStart(item?: CourseTreeItem): Promise<void> {
    await applySnapshotFromItem(item, "start");
  }

  /**
   * Applies the finish snapshot for the chapter row the user clicked.
   *
   * @param item - Explorer chapter row
   */
  async function onApplyChapterFinish(item?: CourseTreeItem): Promise<void> {
    await applySnapshotFromItem(item, "finish");
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("learnByDiff.applyChapterStart", onApplyChapterStart),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("learnByDiff.applyChapterFinish", onApplyChapterFinish),
  );

  /**
   * Loads the session for a chapter tree item, or returns undefined after a warning.
   *
   * @param item - Explorer chapter row
   */
  async function sessionForChapterItem(
    item: CourseTreeItem | undefined,
  ): Promise<{ session: LearningSession; chapterId: string } | undefined> {
    const chapterId = item?.chapterId;
    if (chapterId === undefined || chapterId === "") {
      return undefined;
    }
    const session = await loadFromRoot();
    if (session === undefined) {
      return undefined;
    }
    const exists = session.course.chapters.some((chapter) => chapter.id === chapterId);
    if (!exists) {
      void vscode.window.showWarningMessage(vscode.l10n.t("Unknown chapter: {0}", chapterId));
      return undefined;
    }
    return { session, chapterId };
  }

  /**
   * Copies a chapter snapshot into `.learn/refs` and mounts it in Explorer.
   *
   * @param item - Explorer chapter row
   * @param side - Start or finish snapshot
   */
  async function openRefFolderFromItem(
    item: CourseTreeItem | undefined,
    side: ChapterSnapshotSide,
  ): Promise<void> {
    const loaded = await sessionForChapterItem(item);
    if (loaded === undefined) {
      return;
    }
    try {
      const dest = await materializeChapterRef(git, loaded.session, loaded.chapterId, side);
      const name = chapterRefWorkspaceName(loaded.session.course, loaded.chapterId, side);
      await addOrOpenWorkspaceFolder(dest, name);
    } catch (error) {
      showError(error);
    }
  }

  /**
   * Opens the Not Started snapshot as an Explorer workspace folder.
   *
   * @param item - Explorer chapter row
   */
  async function onOpenChapterStartFolder(item?: CourseTreeItem): Promise<void> {
    await openRefFolderFromItem(item, "start");
  }

  /**
   * Opens the Completed snapshot as an Explorer workspace folder.
   *
   * @param item - Explorer chapter row
   */
  async function onOpenChapterFinishFolder(item?: CourseTreeItem): Promise<void> {
    await openRefFolderFromItem(item, "finish");
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("learnByDiff.openChapterStartFolder", onOpenChapterStartFolder),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "learnByDiff.openChapterFinishFolder",
      onOpenChapterFinishFolder,
    ),
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
   * Loads a session from the learning workspace folder without resetting UI on failure.
   */
  async function loadFromRoot(): Promise<LearningSession | undefined> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    if (folders.length === 0) {
      void vscode.window.showWarningMessage(vscode.l10n.t("Open a folder first."));
      return undefined;
    }
    const root = await workspaceRoot();
    if (root === undefined) {
      void vscode.window.showWarningMessage(
        vscode.l10n.t("This folder is not a LearnByDiff learning workspace."),
      );
      return undefined;
    }
    const session = await loadLearningSession(root);
    if (session === undefined) {
      void vscode.window.showWarningMessage(
        vscode.l10n.t("This folder is not a LearnByDiff learning workspace."),
      );
    }
    return session;
  }

  /**
   * Applies a chapter snapshot from a tree item after validating the session.
   *
   * @param item - Explorer chapter row
   * @param side - Start or finish snapshot
   */
  async function applySnapshotFromItem(
    item: CourseTreeItem | undefined,
    side: ChapterSnapshotSide,
  ): Promise<void> {
    const loaded = await sessionForChapterItem(item);
    if (loaded === undefined) {
      return;
    }
    await applySnapshotWithConfirm(loaded.session, loaded.chapterId, side);
  }

  /**
   * Exports a chapter snapshot into the student tree, confirming with a modal when dirty.
   *
   * @param session - Active learning session
   * @param chapterId - Chapter to apply
   * @param side - Start or finish snapshot
   */
  async function applySnapshotWithConfirm(
    session: LearningSession,
    chapterId: string,
    side: ChapterSnapshotSide,
  ): Promise<void> {
    try {
      await applyChapterSnapshot(git, session, chapterId, side, false);
    } catch (error) {
      if (error instanceof DirtyWorkspaceError) {
        const chapter = session.course.chapters.find((item) => item.id === chapterId);
        const label = chapter?.title ?? chapterId;
        const sideLabel = localizedSnapshotStatus(side);
        const applyLabel = vscode.l10n.t("Apply {0}", sideLabel);
        const confirmed = await vscode.window.showWarningMessage(
          vscode.l10n.t(
            "Overwrite local files with the {1} state of “{0}”? Existing changes cannot be recovered.",
            label,
            sideLabel,
          ),
          { modal: true },
          applyLabel,
        );
        if (confirmed !== applyLabel) {
          return;
        }
        await applyChapterSnapshot(git, session, chapterId, side, true);
      } else {
        showError(error);
        return;
      }
    }
    setSession(session);
    await tree.revealCurrentChapter();
  }

  void restore();
}
