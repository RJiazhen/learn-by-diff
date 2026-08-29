import type { CourseSource } from "./types.ts";

/**
 * Normalizes a source-repo-relative directory path to posix form.
 *
 * Accepts nested paths (`tutorials/hello/start`). Rejects absolute paths,
 * empty segments, and `..` traversal.
 *
 * @param value - Raw path from course/chapter yaml
 * @returns Normalized path, or `undefined` when invalid
 */
export function normalizeSourceDirPath(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === "") {
    return undefined;
  }
  if (trimmed.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(trimmed)) {
    return undefined;
  }
  const segments = trimmed.split(/[/\\]/).filter((segment) => segment !== "");
  if (segments.length === 0) {
    return undefined;
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return undefined;
  }
  return segments.join("/");
}

/**
 * Returns whether `value` is an `http:` or `https:` URL.
 *
 * @param value - Declared docs string
 */
export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

/**
 * Normalizes a chapter-relative file path (for `docs` / `entryFiles`-style values).
 *
 * Rejects absolute paths and `..` traversal. Allows nested paths and file names.
 *
 * @param value - Raw relative file path
 * @returns Normalized posix path, or `undefined` when invalid
 */
export function normalizeRelativeFilePath(value: string): string | undefined {
  return normalizeSourceDirPath(value);
}

/**
 * Resolves a chapter `fromDir` / `toDir` to a path relative to the source repository root.
 *
 * When `source.root` is set, chapter dirs are nested under that prefix so different
 * chapters can live in unrelated subtrees of the same repository.
 *
 * Returns `undefined` when `dir` is empty (empty snapshot tree).
 *
 * @param source - Course `source` block
 * @param dir - Chapter `fromDir` or `toDir` (already protocol-validated when non-empty)
 */
export function resolveSourceSubtreePath(source: CourseSource, dir: string): string | undefined {
  if (dir.trim() === "") {
    return undefined;
  }
  const normalizedDir = normalizeSourceDirPath(dir);
  if (normalizedDir === undefined) {
    throw new Error(`invalid source directory path: ${dir}`);
  }
  const root =
    source.root !== undefined && source.root.trim() !== ""
      ? normalizeSourceDirPath(source.root)
      : undefined;
  if (source.root !== undefined && source.root.trim() !== "" && root === undefined) {
    throw new Error(`invalid source.root path: ${source.root}`);
  }
  if (root === undefined) {
    return normalizedDir;
  }
  return `${root}/${normalizedDir}`;
}
