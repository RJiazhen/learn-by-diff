import type { ChapterConfig } from "@learn-by-diff/protocol";
import { resolveSourceSubtreePath } from "@learn-by-diff/protocol";
import path from "node:path";
import * as vscode from "vscode";
import type { GitClient } from "../git/client.ts";
import {
  classifyEntryChange,
  resolveChapterEntryFiles,
  type EntryChangeKind,
} from "../workspace/entryChange.ts";
import type { LearningSession } from "../workspace/loader.ts";
import { learningPaths } from "../workspace/paths.ts";
import { chapterOrdinal, currentChapter } from "../workspace/session.ts";
import { appliedSnapshotSide, type ChapterSnapshotSide } from "../workspace/state.ts";
import { localizedSnapshotStatus } from "./labels.ts";

/** URI scheme used to decorate chapter rows. */
const CHAPTER_URI_SCHEME = "learnbydiff-chapter";

/** URI scheme used to decorate entry-file rows with U/M/D badges. */
const FILE_URI_SCHEME = "learnbydiff-file";

/** How chapter entry files are nested under each chapter row. */
export type CourseViewMode = "tree" | "list";

const VIEW_MODE_STATE_KEY = "learnByDiff.viewMode";

/** Tree row for a course chapter, folder, or entry file. */
export type CourseTreeItem = vscode.TreeItem & {
  kind: "chapter" | "folder" | "file";
  chapterId: string;
  /** File path or folder prefix relative to the chapter tree root. */
  relativePath?: string;
  changeKind?: EntryChangeKind;
};

/** One changed entry file under a chapter. */
interface ChangedEntryFile {
  relativePath: string;
  changeKind: EntryChangeKind;
}

/**
 * Chapter + entry-file tree in the Explorer LearnByDiff view.
 *
 * Supports SCM-like tree and flat list layouts. Chapter Start / Chapter Finish
 * export that snapshot into the student tree and mark the row as Not Started or Completed.
 * Open Not Started / Completed Folder mounts a runnable copy in Explorer.
 */
export class CourseTreeProvider implements vscode.TreeDataProvider<CourseTreeItem> {
  private session: LearningSession | undefined;
  private treeView: vscode.TreeView<CourseTreeItem> | undefined;
  private viewMode: CourseViewMode;
  private readonly chapterElements = new Map<string, CourseTreeItem>();
  /** Chapter ids the user (or reveal) has expanded — used to auto-expand folder trees. */
  private readonly expandedChapterIds = new Set<string>();
  private readonly emitter = new vscode.EventEmitter<CourseTreeItem | undefined>();

  /**
   * @param git - Git client used to classify entry-file changes
   * @param workspaceState - Persists tree/list view mode
   */
  constructor(
    private readonly git: GitClient,
    private readonly workspaceState: vscode.Memento,
  ) {
    const stored = workspaceState.get<string>(VIEW_MODE_STATE_KEY);
    this.viewMode = stored === "list" ? "list" : "tree";
  }

  /** VS Code subscription hook for tree refresh. */
  readonly onDidChangeTreeData = this.emitter.event;

  /**
   * Sets tree/list view mode, persists it, and refreshes the view.
   *
   * @param mode - Desired layout
   */
  async setViewMode(mode: CourseViewMode): Promise<void> {
    if (this.viewMode === mode) {
      await this.syncViewModeContext();
      return;
    }
    this.viewMode = mode;
    await this.workspaceState.update(VIEW_MODE_STATE_KEY, mode);
    await this.syncViewModeContext();
    this.emitter.fire(undefined);
  }

  /**
   * Publishes `learnByDiff.viewMode` for menu `when` clauses.
   */
  async syncViewModeContext(): Promise<void> {
    await vscode.commands.executeCommand("setContext", "learnByDiff.viewMode", this.viewMode);
  }

  /**
   * Stores the created tree view so current chapter rows can be revealed,
   * and tracks which chapters are expanded for tree-mode folder auto-expand.
   *
   * @param treeView - View registered for `learnByDiff.courseView`
   */
  setTreeView(treeView: vscode.TreeView<CourseTreeItem>): void {
    this.treeView = treeView;
    treeView.onDidExpandElement((event) => {
      if (event.element.kind === "chapter") {
        this.expandedChapterIds.add(event.element.chapterId);
      }
    });
    treeView.onDidCollapseElement((event) => {
      if (event.element.kind === "chapter") {
        this.expandedChapterIds.delete(event.element.chapterId);
      }
    });
  }

  /**
   * Replaces the session shown in the tree and refreshes.
   *
   * @param session - Active session, or `undefined` to clear
   */
  setSession(session: LearningSession | undefined): void {
    this.session = session;
    this.chapterElements.clear();
    this.expandedChapterIds.clear();
    this.emitter.fire(undefined);
    if (session !== undefined) {
      void this.revealCurrentChapter();
    }
  }

  /**
   * Expands the current chapter so its entry files are visible (does not steal selection).
   */
  async revealCurrentChapter(): Promise<void> {
    if (this.session === undefined || this.treeView === undefined) {
      return;
    }
    const chapter = currentChapter(this.session);
    const element =
      this.chapterElements.get(chapter.id) ??
      this.buildChapterItem(
        chapter,
        appliedSnapshotSide(this.session.progress),
        this.session.course.chapters.findIndex((item) => item.id === chapter.id),
        this.session.course.chapters.length,
      );
    this.chapterElements.set(chapter.id, element);
    try {
      await this.treeView.reveal(element, { expand: true, select: false, focus: false });
    } catch {
      // Tree may not be visible yet; ignore.
    }
  }

  /**
   * Clears any tree selection so opening a diff does not leave a sticky file highlight.
   * Refocuses the active editor group afterward when the tree had to take focus to clear.
   */
  async clearSelection(): Promise<void> {
    if (this.treeView === undefined || this.treeView.selection.length === 0) {
      return;
    }
    try {
      await vscode.commands.executeCommand("list.clearSelection");
    } catch {
      // Command unavailable in this host.
    }
    if (this.treeView.selection.length === 0) {
      return;
    }
    // Selection APIs only affect the focused list; reclaim focus briefly, then return.
    try {
      await vscode.commands.executeCommand("learnByDiff.courseView.focus");
      await vscode.commands.executeCommand("list.clearSelection");
      await vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
    } catch {
      // View or editor commands unavailable.
    }
  }

  /**
   * Returns the tree item for display.
   */
  getTreeItem(element: CourseTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Returns the parent element for `reveal` support.
   *
   * @param element - Tree element
   */
  getParent(element: CourseTreeItem): CourseTreeItem | undefined {
    if (element.kind === "chapter") {
      return undefined;
    }
    const chapterItem = this.chapterElements.get(element.chapterId);
    if (element.kind === "file" && this.viewMode === "list") {
      return chapterItem;
    }
    const relative = element.relativePath ?? "";
    const parentPath = path.posix.dirname(relative);
    if (parentPath === "." || parentPath === "") {
      return chapterItem;
    }
    if (this.session === undefined) {
      return chapterItem;
    }
    const chapter = this.session.course.chapters.find((item) => item.id === element.chapterId);
    if (chapter === undefined) {
      return chapterItem;
    }
    return this.buildFolderItem(chapter, parentPath);
  }

  /**
   * Returns chapter rows, folders, or entry files depending on view mode.
   *
   * @param element - Parent element, or `undefined` for the root
   */
  async getChildren(element?: CourseTreeItem): Promise<CourseTreeItem[]> {
    if (this.session === undefined) {
      return [];
    }
    if (element === undefined) {
      const current = currentChapter(this.session);
      const appliedSide = appliedSnapshotSide(this.session.progress);
      const total = this.session.course.chapters.length;
      return this.session.course.chapters.map((chapter, index) => {
        const side = chapter.id === current.id ? appliedSide : undefined;
        const item = this.buildChapterItem(chapter, side, index, total);
        this.chapterElements.set(chapter.id, item);
        return item;
      });
    }
    if (element.kind === "file") {
      return [];
    }

    const chapter = this.session.course.chapters.find((item) => item.id === element.chapterId);
    if (chapter === undefined) {
      return [];
    }
    const changed = await this.listChangedEntryFiles(chapter);
    if (element.kind === "chapter") {
      // getChildren runs when the chapter is (being) expanded — mark before building folders
      // so tree-mode folders default to Expanded under open chapters.
      this.expandedChapterIds.add(chapter.id);
      return this.viewMode === "list"
        ? changed.map((entry) => this.buildFileItem(chapter, entry.relativePath, entry.changeKind))
        : this.buildTreeChildren(chapter, "", changed);
    }
    return this.buildTreeChildren(chapter, element.relativePath ?? "", changed);
  }

  /**
   * Lists entry files that differ between a chapter's from/to snapshots.
   *
   * @param chapter - Chapter config
   */
  private async listChangedEntryFiles(chapter: ChapterConfig): Promise<ChangedEntryFile[]> {
    if (this.session === undefined) {
      return [];
    }
    const { sourceMirror } = learningPaths(this.session.workspaceRoot);
    const source = this.session.course.config.source;
    const fromSubtree = resolveSourceSubtreePath(source, chapter.fromDir);
    const toSubtree = resolveSourceSubtreePath(source, chapter.toDir);
    const entryFiles = await resolveChapterEntryFiles(this.git, sourceMirror, source, chapter);
    const items: ChangedEntryFile[] = [];
    for (const relativePath of entryFiles) {
      const changeKind = await classifyEntryChange(
        this.git,
        sourceMirror,
        fromSubtree,
        toSubtree,
        relativePath,
      );
      if (changeKind === undefined) {
        continue;
      }
      items.push({ relativePath, changeKind });
    }
    return items;
  }

  /**
   * Builds immediate folder/file children under `folderPath` in tree mode.
   *
   * @param chapter - Parent chapter
   * @param folderPath - Folder prefix (empty string at chapter root)
   * @param changed - All changed entry files for the chapter
   */
  private buildTreeChildren(
    chapter: ChapterConfig,
    folderPath: string,
    changed: ChangedEntryFile[],
  ): CourseTreeItem[] {
    const prefix = folderPath === "" ? "" : `${folderPath}/`;
    const folders = new Set<string>();
    const files: ChangedEntryFile[] = [];

    for (const entry of changed) {
      if (prefix !== "" && !entry.relativePath.startsWith(prefix)) {
        continue;
      }
      const rest = prefix === "" ? entry.relativePath : entry.relativePath.slice(prefix.length);
      const slash = rest.indexOf("/");
      if (slash === -1) {
        files.push(entry);
      } else {
        folders.add(prefix === "" ? rest.slice(0, slash) : `${folderPath}/${rest.slice(0, slash)}`);
      }
    }

    const folderItems = [...folders]
      .sort((left, right) => left.localeCompare(right))
      .map((folder) => this.buildFolderItem(chapter, folder));
    const fileItems = files
      .sort((left, right) => left.relativePath.localeCompare(right.relativePath))
      .map((entry) => this.buildFileItem(chapter, entry.relativePath, entry.changeKind));
    return [...folderItems, ...fileItems];
  }

  /**
   * Builds a collapsible chapter row with a zero-padded ordinal prefix.
   *
   * @param chapter - Chapter config
   * @param appliedSide - Snapshot side when this chapter is applied to the student tree
   * @param index - Zero-based chapter index
   * @param total - Total number of chapters
   */
  private buildChapterItem(
    chapter: ChapterConfig,
    appliedSide: ChapterSnapshotSide | undefined,
    index: number,
    total: number,
  ): CourseTreeItem {
    const ordinal = chapterOrdinal(Math.max(index, 0), total);
    const hasEntries = chapter.entryFiles === undefined || chapter.entryFiles.length > 0;
    const expanded = this.expandedChapterIds.has(chapter.id);
    const item = new vscode.TreeItem(
      `${ordinal}-${chapter.title}`,
      !hasEntries
        ? vscode.TreeItemCollapsibleState.None
        : expanded
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed,
    ) as CourseTreeItem;
    item.kind = "chapter";
    item.chapterId = chapter.id;
    const hasDocs = chapter.docs !== undefined && chapter.docs.trim() !== "";
    const sideToken = appliedSide === undefined ? "" : `-${appliedSide}`;
    if (hasDocs) {
      item.contextValue = `chapter${sideToken}-docs`;
    } else {
      item.contextValue = `chapter${sideToken}`;
    }
    const status = appliedSide === undefined ? undefined : localizedSnapshotStatus(appliedSide);
    item.description = status;
    item.tooltip = `${ordinal}-${chapter.title}${
      status === undefined ? "" : ` (${status})`
    }${hasDocs ? `\n${vscode.l10n.t("Docs: {0}", chapter.docs ?? "")}` : ""}`;
    item.resourceUri = vscode.Uri.from({
      scheme: CHAPTER_URI_SCHEME,
      path: `/${chapter.id}`,
      query: appliedSide ?? "",
    });
    return item;
  }

  /**
   * Builds a folder row used only in tree view mode (no folder icon, like SCM).
   * Folders under an already-expanded chapter start expanded.
   *
   * @param chapter - Parent chapter
   * @param folderPath - Folder path relative to the chapter tree root
   */
  private buildFolderItem(chapter: ChapterConfig, folderPath: string): CourseTreeItem {
    const expandFolders = this.expandedChapterIds.has(chapter.id);
    const item = new vscode.TreeItem(
      path.posix.basename(folderPath),
      expandFolders
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed,
    ) as CourseTreeItem;
    item.kind = "folder";
    item.chapterId = chapter.id;
    item.relativePath = folderPath;
    item.contextValue = "chapterFolder";
    item.tooltip = folderPath;
    return item;
  }

  /**
   * Builds an entry-file row (SCM-style name + U/M/D decoration).
   *
   * @param chapter - Parent chapter
   * @param relativePath - Path from chapter `entryFiles`
   * @param changeKind - U/M/D classification
   */
  private buildFileItem(
    chapter: ChapterConfig,
    relativePath: string,
    changeKind: EntryChangeKind,
  ): CourseTreeItem {
    const item = new vscode.TreeItem(
      path.posix.basename(relativePath),
      vscode.TreeItemCollapsibleState.None,
    ) as CourseTreeItem;
    item.kind = "file";
    item.chapterId = chapter.id;
    item.relativePath = relativePath;
    item.changeKind = changeKind;
    if (this.viewMode === "list") {
      const folder = path.posix.dirname(relativePath);
      item.description = folder === "." ? undefined : folder;
    }
    item.contextValue = "chapterFile";
    item.tooltip = `${relativePath} (${chapter.fromDir} ↔ ${chapter.toDir}) · ${changeKind}`;
    item.resourceUri = vscode.Uri.from({
      scheme: FILE_URI_SCHEME,
      path: `/${chapter.id}/${relativePath.split(/[/\\]/).join("/")}`,
      query: changeKind,
    });
    item.command = {
      command: "learnByDiff.openFileDiff",
      title: vscode.l10n.t("Open File Diff"),
      arguments: [item],
    };
    return item;
  }
}

/**
 * Decorates the applied chapter (label color) and entry files (U/M/D badges).
 */
export class LearnByDiffDecorationProvider implements vscode.FileDecorationProvider {
  private readonly emitter = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();

  /** VS Code subscription hook for decoration refresh. */
  readonly onDidChangeFileDecorations = this.emitter.event;

  /**
   * Asks VS Code to re-query decorations (e.g. after chapter switch).
   */
  refresh(): void {
    this.emitter.fire(undefined);
  }

  /**
   * Returns a decoration for chapter or file resource URIs.
   *
   * @param uri - Resource URI from a tree item
   */
  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (uri.scheme === CHAPTER_URI_SCHEME) {
      if (uri.query !== "start" && uri.query !== "finish") {
        return undefined;
      }
      return {
        color: new vscode.ThemeColor("learnByDiff.currentChapter"),
        tooltip: localizedSnapshotStatus(uri.query === "finish" ? "finish" : "start"),
      };
    }
    if (uri.scheme !== FILE_URI_SCHEME) {
      return undefined;
    }
    const kind = uri.query;
    if (kind === "U") {
      return {
        badge: "U",
        color: new vscode.ThemeColor("gitDecoration.untrackedResourceForeground"),
        tooltip: vscode.l10n.t("Added in chapter goal"),
      };
    }
    if (kind === "M") {
      return {
        badge: "M",
        color: new vscode.ThemeColor("gitDecoration.modifiedResourceForeground"),
        tooltip: vscode.l10n.t("Modified between start and goal"),
      };
    }
    if (kind === "D") {
      return {
        badge: "D",
        color: new vscode.ThemeColor("gitDecoration.deletedResourceForeground"),
        tooltip: vscode.l10n.t("Deleted in chapter goal"),
      };
    }
    return undefined;
  }
}
