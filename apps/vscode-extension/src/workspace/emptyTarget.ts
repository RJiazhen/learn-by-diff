import { readdir } from "node:fs/promises";
import { isCodeWorkspaceFileName } from "./paths.ts";

/**
 * Names that may already exist in an otherwise empty Open Course destination.
 *
 * F5 `sandbox/` ships a README; `.gitignore` is preserved across export; `.git`
 * and `.DS_Store` are not student or course content. Hidden course config and
 * `.learn` are not listed here, so those folders are treated as non-empty.
 */
const EMPTY_TARGET_IGNORED_NAMES = new Set(["README.md", ".git", ".gitignore", ".DS_Store"]);

/**
 * Returns whether `name` can be ignored when deciding if a folder is empty for Open Course.
 *
 * @param name - Basename of a directory entry
 */
function isIgnoredEmptyTargetName(name: string): boolean {
  return EMPTY_TARGET_IGNORED_NAMES.has(name) || isCodeWorkspaceFileName(name);
}

/**
 * Returns whether `dir` is missing or contains only files Open Course may initialize over.
 *
 * Existing learning workspaces, course repositories (including hidden
 * `.course-config`), and any other project files count as non-empty.
 *
 * @param dir - Candidate learning root (need not exist yet)
 */
export async function isEmptyLearningTarget(dir: string): Promise<boolean> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return true;
  }
  return entries.every((name) => isIgnoredEmptyTargetName(name));
}
