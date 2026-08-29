import * as vscode from "vscode";
import { currentChapter, type LearningSession } from "../workspace/session.ts";

/** Tree item kinds shown in the Explorer LearnByDiff view. */
export type CourseTreeItem = vscode.TreeItem & { chapterId?: string };

/**
 * Chapter list contributed to the Explorer view container.
 */
export class CourseTreeProvider implements vscode.TreeDataProvider<CourseTreeItem> {
  private session: LearningSession | undefined;
  private readonly emitter = new vscode.EventEmitter<CourseTreeItem | undefined>();

  /** VS Code subscription hook for tree refresh. */
  readonly onDidChangeTreeData = this.emitter.event;

  /**
   * Replaces the session shown in the tree and refreshes.
   *
   * @param session - Active session, or `undefined` to clear
   */
  setSession(session: LearningSession | undefined): void {
    this.session = session;
    this.emitter.fire(undefined);
  }

  /**
   * Returns the tree item for display.
   */
  getTreeItem(element: CourseTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Returns chapter rows, marking the current chapter.
   */
  getChildren(element?: CourseTreeItem): CourseTreeItem[] {
    if (element !== undefined || this.session === undefined) {
      return [];
    }
    const current = currentChapter(this.session);
    return this.session.course.chapters.map((chapter) => {
      const item = new vscode.TreeItem(chapter.title) as CourseTreeItem;
      item.chapterId = chapter.id;
      item.contextValue = "chapter";
      item.description = chapter.id === current.id ? "current" : chapter.id;
      item.collapsibleState = vscode.TreeItemCollapsibleState.None;
      if (chapter.id === current.id) {
        item.iconPath = new vscode.ThemeIcon("arrow-small-right");
      }
      item.command = {
        command: "learnByDiff.openDiff",
        title: "Open Diff",
        arguments: [item],
      };
      return item;
    });
  }
}
