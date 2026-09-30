import { applyEdits, modify, parse, printParseErrorCode, type ParseError } from "jsonc-parser";

/** One author-declared from/to file difference. */
export interface ChapterChangedFile {
  path: string;
  kind: "U" | "M" | "D";
}

/**
 * Parses JSONC into a value.
 *
 * Comments and trailing commas are allowed. Empty or comments-only text becomes `{}`.
 *
 * @param text - Raw JSONC
 */
export function parseJsonc(text: string): unknown {
  const errors: ParseError[] = [];
  const value: unknown = parse(text, errors, {
    allowTrailingComma: true,
    allowEmptyContent: true,
  });
  if (errors.length > 0) {
    const message = errors.map((error) => printParseErrorCode(error.error)).join("; ");
    throw new Error(`invalid JSONC: ${message}`);
  }
  if (value === undefined || value === null) {
    return {};
  }
  return value;
}

/**
 * Formats a value as pretty JSON with a trailing newline.
 *
 * @param value - JSON value to write
 */
export function formatJsonc(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * Sets `changedFiles` on a chapter JSONC document and keeps other text, including comments.
 *
 * @param text - Existing chapter JSONC
 * @param files - Replacement `changedFiles` array
 */
export function upsertChangedFilesJsonc(text: string, files: ChapterChangedFile[]): string {
  const source = text.trim() === "" ? "{}\n" : text;
  const edits = modify(source, ["changedFiles"], files, {
    formattingOptions: { insertSpaces: true, tabSize: 2 },
  });
  const next = applyEdits(source, edits);
  return next.endsWith("\n") ? next : `${next}\n`;
}
