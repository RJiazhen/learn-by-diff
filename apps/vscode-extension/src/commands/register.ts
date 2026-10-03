import path from "node:path";
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
import { readChapterConfigDownloadRecord } from "../workspace/chapterConfigDownload.ts";
import { openCourse } from "../workspace/openCourse.ts";
import { resumeChapterConfigDownload } from "../workspace/resumeChapterConfigDownload.ts";
import { promptOpenCourseUrl } from "./promptOpenCourse.ts";
import {
  COURSE_JSONC_FIND_EXCLUDE,
  COURSE_JSONC_FIND_INCLUDE,
  collectOpenCourseLinkSources,
  collectOpenCourseLinkSourcesForCourseJsonc,
  currentCourseOpenUrl,
  isWorkspaceCourseJsonc,
  oneClickCopyOptions,
  workspaceCourseCopyPicks,
  type OpenCourseLinkKind,
  type OpenCourseLinkSource,
  type OneClickCopyOption,
  type WorkspaceCourseCopyPick,
} from "../workspace/openCourseLink.ts";
import { materializeChapterRef, chapterRefWorkspaceName } from "../workspace/refs.ts";
import { demoCoursePath } from "../workspace/resolveRepo.ts";
import {
  applyChapterSnapshot,
  currentChapter,
  nextChapter,
  previousChapter,
  sessionHasStudentEdits,
} from "../workspace/session.ts";
import type { ChapterSnapshotSide } from "../workspace/state.ts";
import {
  addOrOpenWorkspaceFolder,
  openLearningWorkspaceIfNeeded,
} from "../workspace/workspaceFolders.ts";
import type { OpenCourseEditorScheme } from "../uri/formatOpenCourseLink.ts";
import { registerUriHandler } from "../uri/registerUriHandler.ts";
import {
  buildGenerateCoursePrompt,
  installGenerateCourseSkill,
  NPX_NOT_FOUND_MESSAGE,
} from "../author/generateCoursePrompt.ts";
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
      if (studentEditCheckTimer !== undefined) {
        clearTimeout(studentEditCheckTimer);
      }
    },
  });
  const isDevHost = context.extensionMode === vscode.ExtensionMode.Development;
  const defaultCourseUrl = isDevHost ? demoCoursePath(context.extensionPath) : undefined;
  /** Learning root last pushed into the UI; used so folder-change restore can re-check snapshots without resetting Explorer. */
  let appliedWorkspaceRoot: string | undefined;
  /** Session whose student tree drives the status-change button. */
  let activeSession: LearningSession | undefined;
  /** Drops a stale edit check when a newer one has started. */
  let studentEditCheckGeneration = 0;
  /** Debounce handle for workspace file events. */
  let studentEditCheckTimer: ReturnType<typeof setTimeout> | undefined;

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
        if ((await readChapterConfigDownloadRecord(root)) !== undefined) {
          resumeChapterConfigDownload({
            git,
            workspaceRoot: root,
            onLog: onPrefetchLog,
            onReady: applySession,
          });
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
    activeSession = session;
    setSession(session);
    scheduleStudentEditCheck(0);
    if (session === undefined) {
      stopBackgroundSnapshotPrefetch();
      return;
    }
    startSnapshotPrefetch(session);
  }

  /**
   * Publishes `learnByDiff.studentHasEdits` so the button matching the current
   * status (Not Started or Completed) can stay disabled until the student edits.
   *
   * A newer check supersedes an in-flight one. Failures leave the button disabled.
   */
  async function publishStudentHasEdits(): Promise<void> {
    const generation = ++studentEditCheckGeneration;
    const session = activeSession;
    let hasEdits = false;
    if (session !== undefined) {
      try {
        hasEdits = await sessionHasStudentEdits(git, session);
      } catch {
        hasEdits = false;
      }
    }
    if (generation !== studentEditCheckGeneration) {
      return;
    }
    await vscode.commands.executeCommand("setContext", "learnByDiff.studentHasEdits", hasEdits);
  }

  /**
   * Queues a student-edit check. Workspace events wait briefly so a save
   * does not compare the tree once per changed file.
   *
   * @param delayMs - Wait before comparing; `0` still runs after the current turn
   */
  function scheduleStudentEditCheck(delayMs = 300): void {
    if (studentEditCheckTimer !== undefined) {
      clearTimeout(studentEditCheckTimer);
    }
    studentEditCheckTimer = setTimeout(() => {
      studentEditCheckTimer = undefined;
      void publishStudentHasEdits();
    }, delayMs);
  }

  /**
   * Re-checks student edits after a file change in the learning workspace.
   *
   * Ignores `.git`, `.learn`, and `node_modules`, which do not count as edits.
   *
   * @param uri - File that was created, changed, or deleted
   */
  function onStudentTreeChanged(uri: vscode.Uri): void {
    const session = activeSession;
    if (session === undefined) {
      return;
    }
    const relative = path.relative(session.workspaceRoot, uri.fsPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      return;
    }
    const top = relative.split(path.sep)[0];
    if (top === ".git" || top === ".learn" || top === "node_modules") {
      return;
    }
    scheduleStudentEditCheck();
  }

  const studentTreeWatcher = vscode.workspace.createFileSystemWatcher("**/*");
  context.subscriptions.push(
    studentTreeWatcher,
    studentTreeWatcher.onDidCreate(onStudentTreeChanged),
    studentTreeWatcher.onDidChange(onStudentTreeChanged),
    studentTreeWatcher.onDidDelete(onStudentTreeChanged),
  );

  /**
   * Shows a notification while unique chapter snapshots download.
   *
   * Open Course starts this after the folder is open. A reloaded or reopened
   * workspace runs it again for any trees still missing.
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
        title: vscode.l10n.t("LearnByDiff: caching snapshots"),
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
      const picked = await promptOpenCourseUrl({
        isDevHost,
        defaultCourseUrl,
        output,
      });
      if (picked === undefined) {
        return;
      }

      await openCourse({
        courseRepoUrl: picked.courseRepoUrl,
        courseJsoncText: picked.courseJsoncText,
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
   * Scrolls the course view to the applied chapter without expanding or selecting it.
   */
  async function onScrollToCurrentChapter(): Promise<void> {
    await tree.revealCurrentChapter({ expand: false });
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("learnByDiff.scrollToCurrentChapter", onScrollToCurrentChapter),
  );

  /**
   * Copies the URL that was used to open the current learning workspace.
   *
   * This is the Open Course input (local path, git URL, or GitHub file URL), not a
   * `vscode://` / `cursor://` one-click URI.
   */
  async function onCopyCurrentCourseUrl(): Promise<void> {
    const session = await loadFromRoot();
    if (session === undefined) {
      return;
    }
    const url = await currentCourseOpenUrl(git, session.workspaceRoot);
    if (url === undefined || url === "") {
      void vscode.window.showWarningMessage(
        vscode.l10n.t("No course URL is recorded for this learning workspace."),
      );
      return;
    }
    await copyToClipboard(url, vscode.l10n.t("Copied the course URL to the clipboard."));
  }

  /**
   * Finds `course.jsonc` files in the open folders and copies one chosen URL.
   */
  async function onCopyWorkspaceCourseUrl(): Promise<void> {
    const courseJsoncPath = await pickWorkspaceCourseJsonc();
    if (courseJsoncPath === undefined) {
      return;
    }
    const sources = await collectOpenCourseLinkSourcesForCourseJsonc(git, courseJsoncPath);
    const pick = await pickWorkspaceCourseCopyAction(sources);
    if (pick === undefined) {
      return;
    }
    if (pick.kind === "plain-local") {
      await copyToClipboard(
        pick.url,
        vscode.l10n.t("Copied the local course.jsonc path to the clipboard."),
      );
      return;
    }
    if (pick.kind === "plain-remote") {
      await copyToClipboard(
        pick.url,
        vscode.l10n.t("Copied the remote course URL to the clipboard."),
      );
      return;
    }
    await copyToClipboard(
      pick.option.uri,
      vscode.l10n.t("Copied the one-click open URL to the clipboard."),
    );
  }

  /**
   * Copies one vscode or cursor one-click open URI for the current learning workspace.
   *
   * Shows every scheme × URL-source pair and copies a single chosen URI.
   */
  async function onCopyOneClickOpenUrl(): Promise<void> {
    const session = await loadFromRoot();
    if (session === undefined) {
      return;
    }
    const sources = await collectOpenCourseLinkSources(git, session.workspaceRoot);
    const options = oneClickCopyOptions(sources);
    /**
     * Maps a one-click option to a QuickPick row.
     *
     * @param option - Scheme and `url=` source pair
     */
    function toPick(option: OneClickCopyOption): vscode.QuickPickItem & { uri: string } {
      return {
        label: oneClickCopyOptionLabel(option),
        description: option.uri,
        uri: option.uri,
      };
    }
    const selected = await vscode.window.showQuickPick(options.map(toPick), {
      title: vscode.l10n.t("LearnByDiff: Copy One-Click Open URL"),
      placeHolder: vscode.l10n.t("Choose one vscode or cursor one-click open URL to copy"),
    });
    if (selected === undefined) {
      return;
    }
    await copyToClipboard(
      selected.uri,
      vscode.l10n.t("Copied the one-click open URL to the clipboard."),
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("learnByDiff.copyCurrentCourseUrl", onCopyCurrentCourseUrl),
    vscode.commands.registerCommand("learnByDiff.copyWorkspaceCourseUrl", onCopyWorkspaceCourseUrl),
    vscode.commands.registerCommand("learnByDiff.copyOneClickOpenUrl", onCopyOneClickOpenUrl),
  );

  /**
   * Installs generate-course-config in the open folder, then copies the agent prompt.
   *
   * The prompt uses placeholder paths the author replaces in chat.
   */
  async function onInstallGenerateCourseSkill(): Promise<void> {
    const snapshotPath = await pickSnapshotRoot();
    if (snapshotPath === undefined) {
      return;
    }
    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: vscode.l10n.t("LearnByDiff: installing generate course skill"),
        },
        /**
         * Runs the skill install in the chosen snapshot folder.
         */
        async function runInstall(): Promise<void> {
          await installGenerateCourseSkill(snapshotPath);
        },
      );
    } catch (error) {
      if (error instanceof Error && error.message === NPX_NOT_FOUND_MESSAGE) {
        void vscode.window.showErrorMessage(vscode.l10n.t(NPX_NOT_FOUND_MESSAGE));
        return;
      }
      showError(error);
      return;
    }
    await copyToClipboard(
      buildGenerateCoursePrompt(),
      vscode.l10n.t("Copied the generate course prompt to the clipboard."),
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "learnByDiff.installGenerateCourseSkill",
      onInstallGenerateCourseSkill,
    ),
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
      // Click already selected the row. Clear before any other await so a later
      // view focus cannot scroll that row to the center of the list.
      await tree.clearSelection();
      // Use loadFromRoot (not restore): restore refreshes the tree + re-selects the
      // chapter, which flashes selection when opening a file diff.
      const session = await loadFromRoot();
      if (session === undefined) {
        return;
      }
      try {
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
    activeSession = session;
    setSession(session);
    scheduleStudentEditCheck(0);
    await tree.revealCurrentChapter();
  }

  void restore();
}

/**
 * Resolves the workspace folder that holds chapter snapshots.
 *
 * One open folder is used as-is. Several folders ask the user to pick.
 *
 * @returns Absolute folder path, or `undefined` when none is open or the pick is cancelled
 */
async function pickSnapshotRoot(): Promise<string | undefined> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) {
    void vscode.window.showWarningMessage(vscode.l10n.t("Open a folder first."));
    return undefined;
  }
  if (folders.length === 1) {
    return folders[0]?.uri.fsPath;
  }
  /**
   * Maps a workspace folder to a QuickPick row.
   *
   * @param folder - Open workspace folder
   */
  function toPick(folder: vscode.WorkspaceFolder): vscode.QuickPickItem & { fsPath: string } {
    return {
      label: folder.name,
      description: folder.uri.fsPath,
      fsPath: folder.uri.fsPath,
    };
  }
  const selected = await vscode.window.showQuickPick(folders.map(toPick), {
    title: vscode.l10n.t("LearnByDiff: Install Generate Course Skill"),
    placeHolder: vscode.l10n.t("Choose the snapshot folder"),
  });
  return selected?.fsPath;
}

/**
 * Writes `text` to the clipboard and shows `message`.
 *
 * @param text - Clipboard contents
 * @param message - Success toast
 */
async function copyToClipboard(text: string, message: string): Promise<void> {
  await vscode.env.clipboard.writeText(text);
  void vscode.window.showInformationMessage(message);
}

/**
 * Prompts for a workspace `course.jsonc`, skipping the picker when only one exists.
 */
async function pickWorkspaceCourseJsonc(): Promise<string | undefined> {
  const folders = vscode.workspace.workspaceFolders;
  if (folders === undefined || folders.length === 0) {
    void vscode.window.showWarningMessage(vscode.l10n.t("Open a folder first."));
    return undefined;
  }
  const uris = await vscode.workspace.findFiles(
    COURSE_JSONC_FIND_INCLUDE,
    COURSE_JSONC_FIND_EXCLUDE,
  );
  const files = uris
    .map((uri) => uri.fsPath)
    .filter(isWorkspaceCourseJsonc)
    .sort();
  if (files.length === 0) {
    void vscode.window.showWarningMessage(
      vscode.l10n.t("No course.jsonc files found in this workspace."),
    );
    return undefined;
  }
  if (files.length === 1) {
    return files[0];
  }
  /**
   * Maps a `course.jsonc` path to a QuickPick row.
   *
   * @param filePath - Absolute `course.jsonc` path
   */
  function toPick(filePath: string): vscode.QuickPickItem & { filePath: string } {
    return {
      label: vscode.workspace.asRelativePath(filePath),
      description: filePath,
      filePath,
    };
  }
  const selected = await vscode.window.showQuickPick(files.map(toPick), {
    title: vscode.l10n.t("LearnByDiff: Copy Workspace Course URL"),
    placeHolder: vscode.l10n.t("Choose a course.jsonc file"),
  });
  return selected?.filePath;
}

/**
 * Prompts for a workspace copy action after a `course.jsonc` is chosen.
 *
 * @param sources - `url=` sources derived from the chosen file
 */
async function pickWorkspaceCourseCopyAction(
  sources: OpenCourseLinkSource[],
): Promise<WorkspaceCourseCopyPick | undefined> {
  /**
   * Maps a copy row to a QuickPick item.
   *
   * @param pick - Plain URL or one-click URI to copy
   */
  function toPick(
    pick: WorkspaceCourseCopyPick,
  ): vscode.QuickPickItem & { pick: WorkspaceCourseCopyPick } {
    return {
      label: workspaceCourseCopyPickLabel(pick),
      description: workspaceCourseCopyPickDescription(pick),
      pick,
    };
  }
  const selected = await vscode.window.showQuickPick(
    workspaceCourseCopyPicks(sources).map(toPick),
    {
      title: vscode.l10n.t("LearnByDiff: Copy Workspace Course URL"),
      placeHolder: vscode.l10n.t("Choose what to copy"),
    },
  );
  return selected?.pick;
}

/**
 * Returns the QuickPick label for a workspace copy row.
 *
 * @param pick - Plain URL or one-click URI to copy
 */
function workspaceCourseCopyPickLabel(pick: WorkspaceCourseCopyPick): string {
  switch (pick.kind) {
    case "plain-local":
      return vscode.l10n.t("Copy local course URL");
    case "plain-remote":
      return vscode.l10n.t("Copy remote course URL");
    case "one-click":
      return oneClickCopyOptionLabel(pick.option);
  }
}

/**
 * Returns the URL shown beside a workspace copy row.
 *
 * @param pick - Plain URL or one-click URI to copy
 */
function workspaceCourseCopyPickDescription(pick: WorkspaceCourseCopyPick): string {
  if (pick.kind === "one-click") {
    return pick.option.uri;
  }
  return pick.url;
}

/**
 * Returns the QuickPick label for a vscode or cursor one-click copy row.
 *
 * @param option - Scheme and `url=` source pair
 */
function oneClickCopyOptionLabel(option: OneClickCopyOption): string {
  return vscode.l10n.t(
    "Copy {0} one-click open URL ({1})",
    openCourseEditorSchemeLabel(option.scheme),
    openCourseLinkKindLabel(option.source.kind),
  );
}

/**
 * Returns the QuickPick label for a one-click editor scheme.
 *
 * @param scheme - `vscode` or `cursor`
 */
function openCourseEditorSchemeLabel(scheme: OpenCourseEditorScheme): string {
  switch (scheme) {
    case "vscode":
      return vscode.l10n.t("VS Code");
    case "cursor":
      return vscode.l10n.t("Cursor");
  }
}

/**
 * Returns the QuickPick label for a one-click open-link URL source.
 *
 * @param kind - Local path or git URL
 */
function openCourseLinkKindLabel(kind: OpenCourseLinkKind): string {
  switch (kind) {
    case "local":
      return vscode.l10n.t("Local course.jsonc path");
    case "git":
      return vscode.l10n.t("Remote git URL");
  }
}
