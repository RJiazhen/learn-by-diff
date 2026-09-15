import * as vscode from "vscode";
import type { GitClient } from "../git/client.ts";
import { openChapterFileDiff } from "../ui/diff.ts";
import type { CourseTreeItem, CourseTreeProvider } from "../ui/explorerView.ts";
import { localizedSnapshotStatus } from "../ui/labels.ts";
import { openChapterDocs } from "../ui/openDocs.ts";
import { chapterSearchPicks, type ChapterSearchPick } from "../ui/searchChapter.ts";
import {
  startBackgroundSnapshotPrefetch,
  stopBackgroundSnapshotPrefetch,
  type SnapshotPrefetchProgress,
} from "../snapshot/prefetch.ts";
import { reportSnapshotPrefetchProgress } from "../snapshot/prefetchProgress.ts";
import { DirtyWorkspaceError } from "../workspace/errors.ts";
import {
  findLearningWorkspaceRoot,
  loadLearningSession,
  type LearningSession,
} from "../workspace/loader.ts";
import { openCourse } from "../workspace/openCourse.ts";
import { materializeChapterRef, chapterRefWorkspaceName } from "../workspace/refs.ts";
import { demoCoursePath } from "../workspace/resolveRepo.ts";
import {
  applyChapterSnapshot,
  currentChapter,
  nextChapter,
  previousChapter,
} from "../workspace/session.ts";
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
  context.subscriptions.push(output, {
    /**
     * Cancels background snapshot prefetch when the extension deactivates.
     */
    dispose: () => {
      stopBackgroundSnapshotPrefetch();
    },
  });
  const isDevHost = context.extensionMode === vscode.ExtensionMode.Development;
  const defaultCourseUrl = isDevHost ? demoCoursePath(context.extensionPath) : undefined;
  /** Learning root last pushed into the UI; used so folder-change restore can re-check snapshots without resetting Explorer. */
  let appliedWorkspaceRoot: string | undefined;

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
   * Re-checks snapshot cache whenever a learning workspace is (still) open so
   * Open Recent / folder-mode opens download any missing trees.
   */
  async function restore(): Promise<LearningSession | undefined> {
    let awaitingHostReload = false;
    try {
      const root = await workspaceRoot();
      if (root === undefined) {
        applySession(undefined);
        return undefined;
      }
      try {
        if (await openLearningWorkspaceIfNeeded(root)) {
          awaitingHostReload = true;
          return undefined;
        }
        const session = await loadLearningSession(root);
        if (session !== undefined && appliedWorkspaceRoot === session.workspaceRoot) {
          startSnapshotPrefetch(session);
          return session;
        }
        applySession(session);
        return session;
      } catch (error) {
        applySession(undefined);
        showError(error);
        return undefined;
      }
    } finally {
      if (!awaitingHostReload) {
        await vscode.commands.executeCommand("setContext", "learnByDiff.ready", true);
      }
    }
  }

  /**
   * Appends a background prefetch log line to the LearnByDiff output channel.
   *
   * @param line - Message to append
   */
  function onPrefetchLog(line: string): void {
    output.appendLine(line);
  }

  /**
   * Checks `.learn/snapshots` and downloads any missing unique source trees.
   *
   * Safe to call on every workspace open; no-ops when a run for this root is
   * already in progress, and skips the notification when the cache is complete.
   *
   * @param session - Active learning session
   */
  function startSnapshotPrefetch(session: LearningSession): void {
    startBackgroundSnapshotPrefetch(git, session, {
      onLog: onPrefetchLog,
      runProgress: runSnapshotDownloadProgress,
    });
  }

  /**
   * Pushes session into the UI and starts background chapter-snapshot prefetch.
   *
   * Prefetch is skipped when `session` is undefined (not a learning workspace).
   *
   * @param session - Active learning session, or `undefined` to clear
   */
  function applySession(session: LearningSession | undefined): void {
    appliedWorkspaceRoot = session?.workspaceRoot;
    setSession(session);
    if (session === undefined) {
      stopBackgroundSnapshotPrefetch();
      return;
    }
    startSnapshotPrefetch(session);
  }

  /**
   * Shows a notification while unique chapter snapshots download.
   *
   * Uses the same “opening course” title as Open Course so create + prefetch
   * never appear as two stacked popups. Skipped when the cache is already complete.
   *
   * @param work - Prefetch body that reports per-tree progress
   * @param abort - Controller cancelled when the extension deactivates
   */
  async function runSnapshotDownloadProgress(
    work: (
      onProgress: (progress: SnapshotPrefetchProgress) => void,
      signal: AbortSignal,
    ) => Promise<void>,
    abort: AbortController,
  ): Promise<void> {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: vscode.l10n.t("LearnByDiff: opening course"),
        cancellable: false,
      },
      reportSnapshotDownload,
    );

    /**
     * Drives the download notification while unique source trees are cached.
     *
     * @param progress - VS Code progress reporter
     */
    async function reportSnapshotDownload(
      progress: vscode.Progress<{ message?: string; increment?: number }>,
    ): Promise<void> {
      /**
       * Updates the notification message and bar as each unique source tree is cached.
       *
       * @param info - Trees completed, total, and the subtree just written
       */
      const onProgress = (info: SnapshotPrefetchProgress): void => {
        reportSnapshotPrefetchProgress(progress, info);
      };
      await work(onProgress, abort.signal);
    }
  }

  registerUriHandler(context, git, output, applySession);

  /**
   * Re-loads session and re-checks snapshot cache when Explorer roots change.
   *
   * Covers Open Recent, folder-mode opens, and extra chapter-ref folders. Same
   * learning root only re-prefetches missing trees (does not reset the tree UI).
   */
  function onWorkspaceFoldersChanged(): void {
    void restore();
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(onWorkspaceFoldersChanged),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("learnByDiff.openCourse", async () => {
      const url = await vscode.window.showInputBox({
        title: vscode.l10n.t("LearnByDiff: Open Course"),
        prompt: isDevHost
          ? vscode.l10n.t(
              "Path to course.yml (prefilled with local examples/demo-course/.course-config/course.yml)",
            )
          : vscode.l10n.t(
              "Path to course.yml, a GitHub course.yml URL, or a git URL to a course repository",
            ),
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
        onSession: applySession,
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
   * Opens a QuickPick of chapters and reveals the chosen row in Explorer.
   *
   * Does not apply a snapshot; students still use Not Started / Completed to switch.
   */
  async function onSearchChapter(): Promise<void> {
    const session = await loadFromRoot();
    if (session === undefined) {
      return;
    }
    const current = currentChapter(session);
    const picks = chapterSearchPicks(session.course.chapters, current.id);
    /**
     * Maps a search row to a QuickPick item, marking the applied chapter.
     *
     * @param pick - Chapter search row
     */
    function toQuickPickItem(pick: ChapterSearchPick): vscode.QuickPickItem & {
      chapterId: string;
    } {
      return {
        label: pick.label,
        description: pick.description,
        chapterId: pick.chapterId,
        iconPath: pick.current ? new vscode.ThemeIcon("mortar-board") : undefined,
      };
    }
    const selected = await vscode.window.showQuickPick(picks.map(toQuickPickItem), {
      title: vscode.l10n.t("LearnByDiff: Search Chapter"),
      placeHolder: vscode.l10n.t("Filter by chapter title or id"),
      matchOnDescription: true,
    });
    if (selected === undefined) {
      return;
    }
    await tree.revealChapter(selected.chapterId);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("learnByDiff.searchChapter", onSearchChapter),
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
