import { access, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { isSameFolder, learningPaths } from "./paths.ts";

/** One folder entry in a `.code-workspace` file. */
interface WorkspaceFolderSpec {
  name?: string;
  path: string;
}

/** Serializable `.code-workspace` body we write and migrate. */
interface WorkspaceFileBody {
  folders: WorkspaceFolderSpec[];
  settings?: Record<string, unknown>;
}

/** Hidden generated trees and the workspace file itself in the student Explorer root. */
const DEFAULT_FILES_EXCLUDE: Record<string, boolean> = {
  "*.code-workspace": true,
  ".learn/source.git": true,
  ".learn/snapshots": true,
  ".learn/refs": true,
};

/**
 * Creates a single-folder `.code-workspace` at the learning root if it is missing.
 *
 * The file is named after the course directory so Open Recent shows that name
 * and reopening loads saved extra roots (chapter Not Started / Completed
 * folders). Opening a `.code-workspace` (even with one folder) keeps the window
 * in multi-root mode, so later `updateWorkspaceFolders` does not restart the
 * host. Does not overwrite an existing file. Migrates a legacy file under
 * `.learn/` when present.
 *
 * @param workspaceRoot - Learning repository root
 * @returns Absolute path of the `.code-workspace` file
 */
export async function ensureLearningWorkspaceFile(workspaceRoot: string): Promise<string> {
  const paths = learningPaths(workspaceRoot);
  const resolvedRoot = path.resolve(workspaceRoot);

  let hadNewFile = true;
  try {
    await access(paths.workspaceFile);
  } catch {
    hadNewFile = false;
  }

  if (!hadNewFile) {
    const migrated = await readMigratedLegacyWorkspace(resolvedRoot, paths.legacyWorkspaceFile);
    const body = migrated ?? defaultWorkspaceBody(resolvedRoot);
    await writeFile(paths.workspaceFile, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  } else {
    await removeIfPresent(paths.legacyWorkspaceFile);
  }

  return paths.workspaceFile;
}

/**
 * Returns the initial workspace: student tree only, named after the directory.
 *
 * @param workspaceRoot - Absolute learning repository root
 */
function defaultWorkspaceBody(workspaceRoot: string): WorkspaceFileBody {
  return {
    folders: [{ name: path.basename(workspaceRoot), path: "." }],
    settings: {
      "files.exclude": { ...DEFAULT_FILES_EXCLUDE },
    },
  };
}

/**
 * Reads and rewrites a legacy `.learn/learn-by-diff.code-workspace`, or `undefined`.
 *
 * Relative paths in that file are resolved from `.learn/`. The dummy `refs`
 * root is dropped; chapter copies become `.learn/refs/…` relative to the
 * learning root.
 *
 * @param workspaceRoot - Absolute learning repository root
 * @param legacyFile - Absolute path of the old workspace file
 */
async function readMigratedLegacyWorkspace(
  workspaceRoot: string,
  legacyFile: string,
): Promise<WorkspaceFileBody | undefined> {
  let raw: string;
  try {
    raw = await readFile(legacyFile, "utf8");
  } catch {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (parsed === null || typeof parsed !== "object" || !("folders" in parsed)) {
    return undefined;
  }
  const record = parsed as WorkspaceFileBody;
  if (!Array.isArray(record.folders)) {
    return undefined;
  }
  const learnDir = path.join(workspaceRoot, ".learn");
  const folders = rewriteLegacyFolders(record.folders, workspaceRoot, learnDir);
  return mergeDefaultExclude({ ...record, folders });
}

/**
 * Rewrites folder paths from a workspace file that lived under `.learn/`.
 *
 * @param folders - Entries from the legacy file
 * @param workspaceRoot - Absolute learning repository root
 * @param learnDir - Absolute `.learn` directory (legacy relative base)
 */
function rewriteLegacyFolders(
  folders: WorkspaceFolderSpec[],
  workspaceRoot: string,
  learnDir: string,
): WorkspaceFolderSpec[] {
  const rootName = path.basename(workspaceRoot);
  const rewritten: WorkspaceFolderSpec[] = [];
  for (const folder of folders) {
    const mapped = rewriteLegacyFolder(folder, workspaceRoot, learnDir, rootName);
    if (mapped !== undefined) {
      rewritten.push(mapped);
    }
  }
  if (!rewritten.some((folder) => folder.path === ".")) {
    rewritten.unshift({ name: rootName, path: "." });
  }
  const studentIndex = rewritten.findIndex((folder) => folder.path === ".");
  if (studentIndex > 0) {
    const [student] = rewritten.splice(studentIndex, 1);
    if (student !== undefined) {
      rewritten.unshift(student);
    }
  }
  return rewritten;
}

/**
 * Maps one legacy folder to a root-relative entry, or drops the dummy `refs` root.
 *
 * @param folder - Legacy folder spec
 * @param workspaceRoot - Absolute learning repository root
 * @param learnDir - Absolute `.learn` directory
 * @param rootName - Course directory basename
 */
function rewriteLegacyFolder(
  folder: WorkspaceFolderSpec,
  workspaceRoot: string,
  learnDir: string,
  rootName: string,
): WorkspaceFolderSpec | undefined {
  const resolved = path.isAbsolute(folder.path)
    ? path.resolve(folder.path)
    : path.resolve(learnDir, folder.path);
  if (isSameFolder(resolved, path.join(learnDir, "refs"))) {
    return undefined;
  }
  if (isSameFolder(resolved, workspaceRoot)) {
    return { name: rootName, path: "." };
  }
  const relative = path.relative(workspaceRoot, resolved).split(path.sep).join("/");
  if (relative === "" || relative === ".") {
    return { name: rootName, path: "." };
  }
  return { name: folder.name, path: relative };
}

/**
 * Ensures default `files.exclude` keys are present without dropping other settings.
 *
 * @param body - Workspace file body after folder rewrite
 */
function mergeDefaultExclude(body: WorkspaceFileBody): WorkspaceFileBody {
  const existingExclude =
    body.settings !== undefined &&
    typeof body.settings["files.exclude"] === "object" &&
    body.settings["files.exclude"] !== null
      ? (body.settings["files.exclude"] as Record<string, unknown>)
      : {};
  return {
    ...body,
    settings: {
      ...body.settings,
      "files.exclude": { ...DEFAULT_FILES_EXCLUDE, ...existingExclude },
    },
  };
}

/**
 * Deletes `filePath` when it exists.
 *
 * @param filePath - File to remove
 */
async function removeIfPresent(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch {
    // Already gone.
  }
}
