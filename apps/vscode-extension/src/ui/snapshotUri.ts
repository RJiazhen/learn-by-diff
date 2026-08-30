import path from "node:path";

/**
 * Encodes an absolute snapshot file path as a virtual URI path (`/posix/segments`).
 *
 * @param fsPath - Absolute snapshot file path
 */
export function encodeSnapshotUriPath(fsPath: string): string {
  return `/${fsPath
    .split(/[/\\]/)
    .filter((segment) => segment !== "")
    .join("/")}`;
}

/**
 * Decodes a virtual snapshot URI path back to an absolute filesystem path.
 *
 * @param uriPath - Path from a `learnbydiff-snapshot` URI
 */
export function decodeSnapshotUriPath(uriPath: string): string {
  if (/^\/[A-Za-z]:/.test(uriPath)) {
    return path.normalize(uriPath.slice(1));
  }
  return path.normalize(uriPath);
}
