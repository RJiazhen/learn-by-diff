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
 * @param courseRepoUrl - User-supplied course repository URL or path
 * @returns Absolute directory when local; otherwise `undefined`
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
 * Relative paths are resolved against the original local course directory so
 * fixtures can use `../demo-source` without baking machine-specific absolutes.
 *
 * @param declared - Value from `course.yml`
 * @param courseRepoUrl - Original course URL/path supplied by the user
 */
export function resolveSourceRepository(declared: string, courseRepoUrl: string): string {
  const trimmed = declared.trim();
  if (trimmed === "") {
    return trimmed;
  }
  if (isRemoteGitUrl(trimmed) || path.isAbsolute(trimmed)) {
    return trimmed;
  }
  const origin = localCourseOrigin(courseRepoUrl);
  if (origin === undefined) {
    return trimmed;
  }
  return path.resolve(origin, trimmed);
}

/**
 * Absolute path to the local demo course when running under Extension Development Host.
 *
 * @param extensionPath - `context.extensionPath` (`apps/vscode-extension`)
 */
export function demoCoursePath(extensionPath: string): string {
  return path.resolve(extensionPath, "../../examples/demo-course");
}
