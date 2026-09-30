import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Returns whether `value` looks like a remote git URL (http(s) or scp-like).
 *
 * @param value - Declared repository string
 */
export function isRemoteGitUrl(value: string): boolean {
  return /^(https?:\/\/|git@|ssh:\/\/)/i.test(value.trim());
}

/**
 * Resolves a course origin path for local clones (`file:` URLs or filesystem paths).
 *
 * @param courseRepoUrl - User-supplied `course.jsonc` path or git URL
 * @returns Absolute path when local; otherwise `undefined`
 */
export function localCourseOrigin(courseRepoUrl: string): string | undefined {
  const trimmed = courseRepoUrl.trim();
  if (trimmed.startsWith("file:")) {
    return fileURLToPath(trimmed);
  }
  if (isRemoteGitUrl(trimmed)) {
    return undefined;
  }
  return path.resolve(trimmed);
}

/**
 * Resolves `source.repository` for clone/mirror.
 *
 * Git URLs stay clone remotes (no path suffix is split off). Absolute local paths
 * are kept. Relative paths and `.` resolve from the directory that contains
 * `course.jsonc` (omitted / `.` means that directory).
 *
 * @param declared - Value from `course.jsonc`
 * @param configDir - Directory that contains the original `course.jsonc`
 */
export function resolveSourceRepository(declared: string, configDir: string): string {
  const trimmed = declared.trim();
  if (trimmed === "" || trimmed === ".") {
    return path.resolve(configDir);
  }
  if (isRemoteGitUrl(trimmed) || path.isAbsolute(trimmed)) {
    return trimmed;
  }
  return path.resolve(configDir, trimmed);
}

/**
 * Absolute path to the local demo `course.jsonc` when running under Extension Development Host.
 *
 * @param extensionPath - `context.extensionPath` (`apps/vscode-extension`)
 */
export function demoCoursePath(extensionPath: string): string {
  return path.resolve(extensionPath, "../../examples/demo-course/.course-config/course.jsonc");
}
