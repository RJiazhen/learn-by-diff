import * as vscode from "vscode";
import { registerCommands } from "./commands/register.ts";
import { GitClient } from "./git/client.ts";
import { CourseTreeProvider } from "./ui/explorerView.ts";
import { registerStatusBar } from "./ui/statusBar.ts";
import type { LearningSession } from "./workspace/loader.ts";

/**
 * Activates LearnByDiff: Explorer view, status bar, and commands.
 *
 * @param context - VS Code extension context
 */
export function activate(context: vscode.ExtensionContext): void {
  const git = new GitClient();
  const tree = new CourseTreeProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("learnByDiff.courseView", tree),
  );
  const updateStatus = registerStatusBar(context);

  /**
   * Pushes session into tree, status bar, and `when` clause context.
   *
   * @param session - Active learning session
   */
  function setSession(session: LearningSession | undefined): void {
    tree.setSession(session);
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
