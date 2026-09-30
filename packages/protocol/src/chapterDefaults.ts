/**
 * Derives a chapter id from a chapter JSONC filename.
 *
 * Strips `.jsonc` and an optional leading numeric prefix (`001-`, `01_`, `1.`).
 *
 * @param fileName - Basename such as `001-hello.jsonc`
 */
export function chapterIdFromFileName(fileName: string): string {
  const base = fileName.replace(/\.jsonc$/i, "");
  const withoutPrefix = base.replace(/^\d+([-_.]\s*|\s+)/, "").replace(/^\d+$/, "");
  const id = (withoutPrefix === "" ? base : withoutPrefix).trim();
  return id === "" ? "chapter" : id;
}
