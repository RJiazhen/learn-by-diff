import path from "node:path";
import type { ChapterConfig } from "@learn-by-diff/protocol";
import * as vscode from "vscode";
import type { GitClient } from "../git/client.ts";
import { classifyEntryChange, type EntryChangeKind } from "../workspace/entryChange.ts";
import { learningPaths } from "../workspace/paths.ts";
import { chapterOrdinal, currentChapter, type LearningSession } from "../workspace/session.ts";

/** URI scheme used to decorate chapter rows. */
export const CHAPTER_URI_SCHEME = "learnbydiff-chapter";

/** URI scheme used to decorate entry-file rows with U/M/D badges. */
export const FILE_URI_SCHEME = "learnbydiff-file";

/** Tree row for a course chapter or one of its entry files. */
export type CourseTreeItem = vscode.TreeItem & {
  kind: "chapter" | "file";
  chapterId: string;
  relativePath?: string;
  changeKind?: EntryChangeKind;
};

/**
 * Chapter + entry-file tree in the Explorer LearnByDiff view.
 *
 * Chapters are collapsible (click toggles the file list). Jumping to a chapter is
 * done via the hover inline action or the context menu — not by clicking the title.
 */
export class CourseTreeProvider implements vscode.TreeDataProvider<CourseTreeItem> {
  private session: LearningSession | undefined;
  private treeView: vscode.TreeView<CourseTreeItem> | undefined;
  private readonly chapterElements = new Map<string, CourseTreeItem>();
  private readonly emitter = new vscode.EventEmitter<CourseTreeItem | undefined>();

  /**
   * @param git - Git client used to classify entry-file changes
   */
  constructor(private readonly git: GitClient) {}

  /** VS Code subscription hook for tree refresh. */
  readonly onDidChangeTreeData = this.emitter.event;

  /**
   * Stores the created tree view so current chapter rows can be revealed.
   *
   * @param treeView - View registered for `learnByDiff.courseView`
   */
  setTreeView(treeView: vscode.TreeView<CourseTreeItem>): void {
    this.treeView = treeView;
  }

  /**
   * Replaces the session shown in the tree and refreshes.
   *
   * @param session - Active session, or `undefined` to clear
   */
  setSession(session: LearningSession | undefined): void {
    this.session = session;
    this.chapterElements.clear();
    this.emitter.fire(undefined);
    if (session !== undefined) {
      void this.revealCurrentChapter();
    }
  }

  /**
   * Expands and selects the current chapter so its entry files are visible.
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
        true,
        this.session.course.chapters.findIndex((item) => item.id === chapter.id),
        this.session.course.chapters.length,
      );
    this.chapterElements.set(chapter.id, element);
    try {
      await this.treeView.reveal(element, { expand: true, select: true, focus: false });
    } catch {
      // Tree may not be visible yet; ignore.
    }
  }

  /**
   * Returns the tree item for display.
   */
  getTreeItem(element: CourseTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Returns the parent chapter for a file row (needed for `reveal`).
   *
   * @param element - Tree element
   */
  getParent(element: CourseTreeItem): CourseTreeItem | undefined {
    if (element.kind !== "file") {
      return undefined;
    }
    return this.chapterElements.get(element.chapterId);
  }

  /**
   * Returns chapter rows, or entry files under an expanded chapter.
   *
   * @param element - Parent element, or `undefined` for the root
   */
  async getChildren(element?: CourseTreeItem): Promise<CourseTreeItem[]> {
    if (this.session === undefined) {
      return [];
    }
    if (element === undefined) {
      const current = currentChapter(this.session);
      const total = this.session.course.chapters.length;
      return this.session.course.chapters.map((chapter, index) => {
        const item = this.buildChapterItem(chapter, chapter.id === current.id, index, total);
        this.chapterElements.set(chapter.id, item);
        return item;
      });
    }
    if (element.kind !== "chapter") {
      return [];
    }
    const chapter = this.session.course.chapters.find((item) => item.id === element.chapterId);
    if (chapter === undefined) {
      return [];
    }
    const { sourceMirror } = learningPaths(this.session.workspaceRoot);
    const items: CourseTreeItem[] = [];
    for (const relativePath of chapter.entryFiles) {
      const changeKind = await classifyEntryChange(
        this.git,
        sourceMirror,
        chapter.fromDir,
        chapter.toDir,
        relativePath,
      );
      if (changeKind === undefined) {
        continue;
      }
      items.push(this.buildFileItem(chapter, relativePath, changeKind));
    }
    return items;
  }

  /**
   * Builds a collapsible chapter row with a zero-padded ordinal prefix.
   *
   * @param chapter - Chapter config
   * @param isCurrent - Whether this is the active chapter
   * @param index - Zero-based chapter index
   * @param total - Total number of chapters
   */
  private buildChapterItem(
    chapter: ChapterConfig,
    isCurrent: boolean,
    index: number,
    total: number,
  ): CourseTreeItem {
    const ordinal = chapterOrdinal(Math.max(index, 0), total);
    const item = new vscode.TreeItem(
      `${ordinal}-${chapter.title}`,
      chapter.entryFiles.length > 0
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
    ) as CourseTreeItem;
    item.kind = "chapter";
    item.chapterId = chapter.id;
    item.contextValue = isCurrent ? "chapter-current" : "chapter";
    item.description = isCurrent ? "current" : undefined;
    item.tooltip = `${ordinal}-${chapter.title}${isCurrent ? " (current)" : ""}`;
    item.resourceUri = vscode.Uri.from({
      scheme: CHAPTER_URI_SCHEME,
      path: `/${chapter.id}`,
      query: isCurrent ? "current" : "",
    });
    return item;
  }

  /**
   * Builds an entry-file row under a chapter (SCM-style name + U/M/D decoration).
   *
   * @param chapter - Parent chapter
   * @param relativePath - Path from chapter `entryFiles`
   * @param changeKind - Optional U/M/D classification
   */
  private buildFileItem(
    chapter: ChapterConfig,
    relativePath: string,
    changeKind: EntryChangeKind | undefined,
  ): CourseTreeItem {
    const item = new vscode.TreeItem(
      path.basename(relativePath),
      vscode.TreeItemCollapsibleState.None,
    ) as CourseTreeItem;
    item.kind = "file";
    item.chapterId = chapter.id;
    item.relativePath = relativePath;
    item.changeKind = changeKind;
    const folder = path.dirname(relativePath);
    item.description = folder === "." ? undefined : folder;
    item.contextValue = "chapterFile";
    item.tooltip = changeKind
      ? `${relativePath} (${chapter.fromDir} ↔ ${chapter.toDir}) · ${changeKind}`
      : `${relativePath} (${chapter.fromDir} ↔ ${chapter.toDir})`;
    item.resourceUri = vscode.Uri.from({
      scheme: FILE_URI_SCHEME,
      path: `/${chapter.id}/${relativePath.split(/[/\\]/).join("/")}`,
      query: changeKind ?? "",
    });
    item.command = {
      command: "learnByDiff.openFileDiff",
      title: "Open File Diff",
      arguments: [item],
    };
    return item;
  }
}

/**
 * Decorates current chapters (label color) and entry files (U/M/D badges).
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
      if (uri.query !== "current") {
        return undefined;
      }
      return {
        color: new vscode.ThemeColor("learnByDiff.currentChapter"),
        tooltip: "Current chapter",
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
        tooltip: "Added in chapter goal",
      };
    }
    if (kind === "M") {
      return {
        badge: "M",
        color: new vscode.ThemeColor("gitDecoration.modifiedResourceForeground"),
        tooltip: "Modified between start and goal",
      };
    }
    if (kind === "D") {
      return {
        badge: "D",
        color: new vscode.ThemeColor("gitDecoration.deletedResourceForeground"),
        tooltip: "Deleted in chapter goal",
      };
    }
    return undefined;
  }
}
