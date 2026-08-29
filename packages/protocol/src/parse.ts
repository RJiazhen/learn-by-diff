import { parse } from "yaml";
import { chapterIdFromFileName } from "./chapterDefaults.ts";
import type { ChapterConfig, CourseConfig } from "./types.ts";
import { ProtocolError } from "./types.ts";

/**
 * Parses a YAML document into an unknown object graph.
 *
 * @param text - Raw YAML
 * @param path - Path used in error messages
 * @returns Parsed value
 */
export function parseYamlDocument(text: string, path: string): unknown {
  try {
    return parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ProtocolError([{ path, message: `invalid YAML: ${message}` }]);
  }
}

/**
 * Parses `course.yml` text without validating required fields.
 *
 * @param text - Raw YAML
 * @param path - Path used in error messages
 */
export function parseCourseYaml(text: string, path: string): CourseConfig {
  const value = parseYamlDocument(text, path);
  if (!isRecord(value)) {
    throw new ProtocolError([{ path, message: "document must be a mapping" }]);
  }
  const source = isRecord(value.source) ? value.source : {};
  const workspace = isRecord(value.workspace) ? value.workspace : {};
  const root = asString(source.root);
  return {
    protocolVersion: asNumber(value.protocolVersion),
    id: asString(value.id),
    title: asString(value.title),
    source: {
      repository: asString(source.repository),
      ...(root !== "" ? { root } : {}),
    },
    workspace: {
      install: asString(workspace.install),
      dev: asString(workspace.dev),
      test: asString(workspace.test),
    },
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
  if (!isRecord(value)) {
    throw new ProtocolError([{ path, message: "document must be a mapping" }]);
  }
  const defaultId = chapterIdFromFileName(fileName);
  const id = asString(value.id) || defaultId;
  const title = asString(value.title) || id;
  const entryFiles = Array.isArray(value.entryFiles) ? asStringArray(value.entryFiles) : undefined;
  return {
    id,
    title,
    fromDir: asString(value.fromDir),
    toDir: asString(value.toDir),
    ...(entryFiles !== undefined ? { entryFiles } : {}),
  };
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
 * Coerces a YAML scalar to number; `NaN` when missing or the wrong type.
 */
function asNumber(value: unknown): number {
  return typeof value === "number" ? value : Number.NaN;
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
