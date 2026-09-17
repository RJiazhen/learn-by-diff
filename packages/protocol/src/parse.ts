import { parse } from "yaml";
import { chapterIdFromFileName } from "./chapterDefaults.ts";
import type { ParsedCourseFields } from "./courseDefaults.ts";
import type { ChapterChangedFile, ChapterConfig } from "./types.ts";
import { isChapterChangeKind, ProtocolError } from "./types.ts";

/**
 * Parses a YAML document into an unknown object graph.
 *
 * @param text - Raw YAML
 * @param path - Path used in error messages
 * @returns Parsed value
 */
function parseYamlDocument(text: string, path: string): unknown {
  try {
    return parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ProtocolError([{ path, message: `invalid YAML: ${message}` }]);
  }
}

/**
 * Parses `course.yml` text without applying path-based defaults.
 *
 * Empty documents and omitted fields become empty strings; call {@link applyCourseDefaults} after.
 *
 * @param text - Raw YAML
 * @param path - Path used in error messages
 */
export function parseCourseYaml(text: string, path: string): ParsedCourseFields {
  const value = parseYamlDocument(text, path);
  if (value === null || value === undefined) {
    return { id: "", title: "", source: { repository: "" }, chaptersDir: "" };
  }
  if (!isRecord(value)) {
    throw new ProtocolError([{ path, message: "document must be a mapping" }]);
  }
  const source = isRecord(value.source) ? value.source : {};
  const root = asString(source.root);
  return {
    id: asString(value.id),
    title: asString(value.title),
    source: {
      repository: asString(source.repository),
      ...(root !== "" ? { root } : {}),
    },
    chaptersDir: asString(value.chaptersDir),
  };
}

/**
 * Parses a chapter yaml document and applies filename-based defaults.
 *
 * @param text - Raw YAML
 * @param path - Path used in error messages
 * @param fileName - Chapter file basename (e.g. `001-hello.yml`) used for default `id`
 */
export function parseChapterYaml(text: string, path: string, fileName: string): ChapterConfig {
  const value = parseYamlDocument(text, path);
  if (value === null || value === undefined) {
    return emptyChapter(fileName);
  }
  if (!isRecord(value)) {
    throw new ProtocolError([{ path, message: "document must be a mapping" }]);
  }
  const defaultId = chapterIdFromFileName(fileName);
  const id = asString(value.id) || defaultId;
  const title = asString(value.title) || id;
  const entryFiles = Array.isArray(value.entryFiles) ? asStringArray(value.entryFiles) : undefined;
  const changedFiles = Array.isArray(value.changedFiles)
    ? parseChangedFiles(value.changedFiles)
    : undefined;
  const docs = asString(value.docs).trim();
  return {
    id,
    title,
    fromDir: asString(value.fromDir),
    toDir: asString(value.toDir),
    ...(entryFiles !== undefined ? { entryFiles } : {}),
    ...(changedFiles !== undefined ? { changedFiles } : {}),
    ...(docs !== "" ? { docs } : {}),
  };
}

/**
 * Parses `changedFiles` mappings; non-objects become empty-path rows so validate can reject them.
 *
 * @param value - YAML sequence under `changedFiles`
 */
function parseChangedFiles(value: unknown[]): ChapterChangedFile[] {
  const files: ChapterChangedFile[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      files.push({ path: "", kind: "U" });
      continue;
    }
    const kindRaw = asString(item.kind);
    files.push({
      path: asString(item.path),
      kind: isChapterChangeKind(kindRaw) ? kindRaw : (kindRaw as ChapterChangedFile["kind"]),
    });
  }
  return files;
}

/**
 * Builds a chapter config with only filename-based defaults.
 *
 * @param fileName - Chapter file basename
 */
function emptyChapter(fileName: string): ChapterConfig {
  const id = chapterIdFromFileName(fileName);
  return { id, title: id, fromDir: "", toDir: "" };
}

/**
 * Returns whether `value` is a non-null object record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Coerces a YAML scalar to string; empty when missing or the wrong type.
 */
function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Coerces a YAML sequence of strings; empty when missing or the wrong type.
 */
function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}
