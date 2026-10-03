import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Snapshot path placeholder written into the copied generate-course prompt. */
export const GENERATE_COURSE_SNAPSHOT_PATH = "./path/to/chapter/code/root/folder";

/** Course output folder written into the copied generate-course prompt. */
export const GENERATE_COURSE_TARGET_FOLDER = "./course-config";

/** Shown when `npx` cannot be started. Callers localize this exact string. */
export const NPX_NOT_FOUND_MESSAGE =
  "npx was not found on PATH. Install Node.js and reopen the window.";

/** Skill spec installed into the workspace that holds the snapshots. */
const GENERATE_COURSE_SKILL_SPEC = "RJiazhen/learn-by-diff@generate-course-config";

/**
 * Returns the npx executable name for the current platform.
 */
export function npxExecutable(): string {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

/**
 * Returns argv for the project-scoped generate-course-config install.
 */
export function generateCourseSkillInstallArgs(): string[] {
  return ["skills", "add", GENERATE_COURSE_SKILL_SPEC, "-y"];
}

/**
 * Builds the agent prompt copied after the skill install.
 *
 * Snapshot path and target folder are placeholders the author edits in chat.
 */
export function buildGenerateCoursePrompt(): string {
  return [
    "/generate-course-config",
    "replace the snapshot path placeholders with the actual paths",
    `Snapshot path: ${GENERATE_COURSE_SNAPSHOT_PATH}`,
    `Target folder: ${GENERATE_COURSE_TARGET_FOLDER}`,
  ].join("\n");
}

/**
 * Installs generate-course-config into `cwd` with `npx skills add`.
 *
 * Rejects when npx is missing or the install exits non-zero.
 *
 * @param cwd - Workspace folder that receives the skill
 */
export async function installGenerateCourseSkill(cwd: string): Promise<void> {
  try {
    await execFileAsync(npxExecutable(), generateCourseSkillInstallArgs(), {
      cwd,
      windowsHide: true,
      shell: process.platform === "win32",
    });
  } catch (error) {
    throw new Error(skillInstallFailureMessage(error));
  }
}

/**
 * Turns an npx failure into a message for the error toast.
 *
 * @param error - `execFile` rejection
 */
function skillInstallFailureMessage(error: unknown): string {
  if (isEnoent(error)) {
    return NPX_NOT_FOUND_MESSAGE;
  }
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return "Failed to install the generate course skill.";
}

/**
 * Returns whether `error` is a missing-executable failure.
 *
 * @param error - Thrown value from `execFile`
 */
function isEnoent(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
