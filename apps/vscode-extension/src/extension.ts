import * as vscode from "vscode";
import { registerCommands } from "./commands/register.ts";
import { GitClient } from "./git/client.ts";
import { EmptyDiffContentProvider, EMPTY_DIFF_SCHEME } from "./ui/diff.ts";
import { CourseTreeProvider, LearnByDiffDecorationProvider } from "./ui/explorerView.ts";
import { registerStatusBar } from "./ui/statusBar.ts";
import type { LearningSession } from "./workspace/loader.ts";

/**
 * Activates LearnByDiff: Explorer view, status bar, and commands.
 *
 * @param context - VS Code extension context
 */
export function activate(context: vscode.ExtensionContext): void {
  const git = new GitClient();
  const tree = new CourseTreeProvider(git);
  const decorations = new LearnByDiffDecorationProvider();
  const emptyDiff = new EmptyDiffContentProvider();
  const treeView = vscode.window.createTreeView("learnByDiff.courseView", {
    treeDataProvider: tree,
    showCollapseAll: true,
  });
  tree.setTreeView(treeView);
  context.subscriptions.push(
    treeView,
    vscode.window.registerFileDecorationProvider(decorations),
    vscode.workspace.registerTextDocumentContentProvider(EMPTY_DIFF_SCHEME, emptyDiff),
  );
  const updateStatus = registerStatusBar(context);

  /**
   * Pushes session into tree, status bar, and `when` clause context.
   *
   * @param session - Active learning session
   */
  function setSession(session: LearningSession | undefined): void {
    tree.setSession(session);
    decorations.refresh();
    updateStatus(session);
    void vscode.commands.executeCommand(
      "setContext",
      "learnByDiff.isLearningWorkspace",
      session !== undefined,
    );
  }

  registerCommands(context, git, tree, setSession);
}

/**
 * Disposes nothing beyond subscriptions registered on the context.
 */
export function deactivate(): void {}
