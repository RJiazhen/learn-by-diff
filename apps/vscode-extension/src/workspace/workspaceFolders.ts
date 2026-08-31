import * as vscode from "vscode";
import { ensureLearningWorkspaceFile } from "./multiRoot.ts";
import { isSameFolder } from "./paths.ts";

/**
 * Adds `folderPath` as a named Explorer workspace folder, or opens a new window if that fails.
 *
 * When the folder is already in the workspace, focuses it in Explorer instead of duplicating.
 *
 * @param folderPath - Absolute directory to mount
 * @param name - Label shown in Explorer
 */
export async function addOrOpenWorkspaceFolder(folderPath: string, name: string): Promise<void> {
  const uri = vscode.Uri.file(folderPath);
  const folders = vscode.workspace.workspaceFolders ?? [];
  const existing = folders.find((folder) => isSameFolder(folder.uri.fsPath, folderPath));
  if (existing !== undefined) {
    await revealExplorerFolder(uri);
    return;
  }

  const added = vscode.workspace.updateWorkspaceFolders(folders.length, 0, { uri, name });
  if (added === true) {
    await revealExplorerFolder(uri);
    return;
  }

  const openInWindow = await vscode.window.showWarningMessage(
    `Could not add “${name}” to this window. Open it in a new window?`,
    "Open in New Window",
  );
  if (openInWindow === "Open in New Window") {
    await vscode.commands.executeCommand("vscode.openFolder", uri, true);
  }
}

/**
 * Opens the learning `.code-workspace` when the window is not already that file.
 *
 * Folder-mode Recents / F5 open the directory; this switches to the named
 * workspace file so extra roots persist and Open Recent can restore them.
 *
 * @param workspaceRoot - Learning repository root
 * @returns `true` when this call asked the host to reload into the workspace file
 */
export async function openLearningWorkspaceIfNeeded(workspaceRoot: string): Promise<boolean> {
  const workspaceFile = await ensureLearningWorkspaceFile(workspaceRoot);
  const current = vscode.workspace.workspaceFile;
  if (
    current !== undefined &&
    current.scheme === "file" &&
    isSameFolder(current.fsPath, workspaceFile)
  ) {
    return false;
  }
  await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(workspaceFile), false);
  return true;
}

/**
 * Reveals `uri` in the Explorer view when the command is available.
 *
 * @param uri - Folder URI
 */
async function revealExplorerFolder(uri: vscode.Uri): Promise<void> {
  try {
    await vscode.commands.executeCommand("revealInExplorer", uri);
  } catch {
    // Command may be missing in some hosts; the folder is still in the workspace.
  }
}
