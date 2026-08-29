/**
 * Derives a chapter id from a chapter yaml filename.
 *
 * Strips `.yml` / `.yaml` and an optional leading numeric prefix (`001-`, `01_`, `1.`).
 *
 * @param fileName - Basename such as `001-hello.yml`
 */
export function chapterIdFromFileName(fileName: string): string {
  const base = fileName.replace(/\.(yml|yaml)$/i, "");
  const withoutPrefix = base.replace(/^\d+([-_.]\s*|\s+)/, "").replace(/^\d+$/, "");
  const id = (withoutPrefix === "" ? base : withoutPrefix).trim();
  return id === "" ? "chapter" : id;
}
