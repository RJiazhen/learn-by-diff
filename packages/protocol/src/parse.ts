import { parse, printParseErrorCode, type ParseError } from "jsonc-parser";
import { chapterIdFromFileName } from "./chapterDefaults.ts";
import type { ParsedCourseFields } from "./courseDefaults.ts";
import type { ChapterChangedFile, ChapterConfig } from "./types.ts";
import { isChapterChangeKind, ProtocolError } from "./types.ts";

/**
 * Parses a JSONC document into an unknown value.
 *
 * Comments and trailing commas are allowed. Empty or comments-only text becomes `undefined`.
 *
 * @param text - Raw JSONC
 * @param path - Path used in error messages
 * @returns Parsed value
 */
function parseJsoncDocument(text: string, path: string): unknown {
  const errors: ParseError[] = [];
  const value: unknown = parse(text, errors, {
    allowTrailingComma: true,
    allowEmptyContent: true,
  });
  if (errors.length > 0) {
    const message = errors.map((error) => printParseErrorCode(error.error)).join("; ");
    throw new ProtocolError([{ path, message: `invalid JSONC: ${message}` }]);
  }
  return value;
}

/**
 * Parses `course.jsonc` text without applying path-based defaults.
 *
 * Empty documents and omitted fields become empty strings; call {@link applyCourseDefaults} after.
 * `$schema` and other unknown properties are ignored.
 *
 * @param text - Raw JSONC
 * @param path - Path used in error messages
 */
export function parseCourseJsonc(text: string, path: string): ParsedCourseFields {
  const value = parseJsoncDocument(text, path);
  if (value === null || value === undefined) {
    return { id: "", title: "", source: { repository: "" }, chaptersDir: "" };
  }
  if (!isRecord(value)) {
    throw new ProtocolError([{ path, message: "document must be an object" }]);
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
 * Parses a chapter JSONC document and applies filename-based defaults.
 *
 * @param text - Raw JSONC
 * @param path - Path used in error messages
 * @param fileName - Chapter file basename (e.g. `001-hello.jsonc`) used for default `id`
 */
export function parseChapterJsonc(text: string, path: string, fileName: string): ChapterConfig {
  const value = parseJsoncDocument(text, path);
  if (value === null || value === undefined) {
    return emptyChapter(fileName);
  }
  if (!isRecord(value)) {
    throw new ProtocolError([{ path, message: "document must be an object" }]);
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
 * Parses `changedFiles` objects; non-objects become empty-path rows so validate can reject them.
 *
 * @param value - JSON array under `changedFiles`
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
 * Coerces a JSON value to string; empty when missing or the wrong type.
 */
function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Coerces a JSON array to strings, dropping non-strings.
 */
function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}
