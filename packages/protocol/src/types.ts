/** Directory name for course protocol files at a repository root. */
export const COURSE_CONFIG_DIR = ".course-config";

/** Filename of the course-level protocol document. */
export const COURSE_FILE_NAME = "course.jsonc";

/** Chapter config extension loaded from `chaptersDir`. */
export const CHAPTER_FILE_EXTENSION = ".jsonc";

/** Default directory of per-chapter JSONC next to `course.jsonc` (`chaptersDir` when omitted). */
export const CHAPTERS_DIR_NAME = "chapters";

/** SCM-style letters for an author-declared from/to file difference. */
export const CHAPTER_CHANGE_KINDS = ["U", "M", "D"] as const;

/** `U` added in `toDir`, `M` modified, `D` deleted from `fromDir`. */
export type ChapterChangeKind = (typeof CHAPTER_CHANGE_KINDS)[number];

/**
 * One file that differs between a chapter's `fromDir` and `toDir`.
 *
 * Filled when the course is created so Open Course can skip snapshot comparison.
 */
export interface ChapterChangedFile {
  /** Path relative to the chapter snapshot tree root. */
  path: string;
  /** How the file changes from start to goal. */
  kind: ChapterChangeKind;
}

/**
 * Returns whether `value` is a {@link ChapterChangeKind}.
 *
 * @param value - Raw kind string from chapter JSONC
 */
export function isChapterChangeKind(value: string): value is ChapterChangeKind {
  return (CHAPTER_CHANGE_KINDS as readonly string[]).includes(value);
}

/** Source repository pointer in `course.jsonc`. */
export interface CourseSource {
  /**
   * Git repository URL, local filesystem path, or `.` for the directory that contains `course.jsonc`.
   * Relative local paths resolve from that same directory. Do not append a subdirectory to a git URL.
   */
  repository: string;
  /**
   * Optional subdirectory under `repository` that prefixes every chapter `fromDir` / `toDir`.
   * Use this when course snapshots live under one monorepo folder (e.g. `learn/demo`).
   */
  root?: string;
}

/**
 * Parsed `course.jsonc` document (after load-time defaults).
 *
 * No field is required in the JSONC file. Defaults:
 * - `id` ← course home folder, or `{repoName}-learn` when that home is a git root
 * - `title` ← `id`
 * - `source.repository` ← `.` (directory that contains `course.jsonc`)
 * - `chaptersDir` ← `chapters` (next to `course.jsonc`)
 *
 * Protocol evolves by adding optional fields only; there is no `protocolVersion` gate.
 */
export interface CourseConfig {
  id: string;
  title: string;
  source: CourseSource;
  /**
   * Directory of chapter JSONC files, relative to the directory that contains `course.jsonc`.
   * Defaults to `chapters`. Nested paths allowed; no `..` or absolutes.
   */
  chaptersDir: string;
}

/**
 * Parsed chapter JSONC document (after load-time defaults).
 *
 * No field is required in the JSONC file. Defaults:
 * - `id` ← filename without numeric prefix (`001-hello.jsonc` → `hello`)
 * - `title` ← `id`
 * - `fromDir` / `toDir` ← `""` (empty snapshot tree)
 * - `entryFiles` ← omitted means discover all files under `toDir` at runtime
 * - `changedFiles` ← omitted means classify from/to at runtime; `[]` means unchanged
 * - `docs` ← omitted means no documentation button
 */
export interface ChapterConfig {
  id: string;
  title: string;
  /**
   * Start snapshot directory relative to the source repo root (or `source.root`).
   * Empty string = empty start tree (no files exported to the student workspace).
   */
  fromDir: string;
  /**
   * Goal snapshot directory relative to the source repo root (or `source.root`).
   * Empty string = empty goal tree (e.g. conceptual chapters with no implementation target).
   */
  toDir: string;
  /**
   * Explicit entry-file list relative to the chapter tree root.
   * `undefined` = auto-discover all files under `toDir` at runtime.
   */
  entryFiles?: string[];
  /**
   * Author-supplied from/to diffs relative to the chapter tree root.
   * `undefined` = classify at runtime; empty = the chapter did not change.
   */
  changedFiles?: ChapterChangedFile[];
  /**
   * Optional chapter documentation: an `http(s)` URL, or a file path relative to the
   * chapter snapshot tree (`toDir`, then `fromDir`) such as `README.md` or `notes/guide.pdf`.
   */
  docs?: string;
}

/** Fully loaded course: root config plus chapters in file-name order. */
export interface Course {
  config: CourseConfig;
  chapters: ChapterConfig[];
  /** Absolute path to the directory that contains the loaded `course.jsonc`. */
  configDir: string;
}

/** One field-level validation failure. */
export interface ProtocolIssue {
  path: string;
  message: string;
}

/** Thrown when JSONC cannot be parsed or fails protocol validation. */
export class ProtocolError extends Error {
  /**
   * Creates a protocol error with one or more field issues.
   *
   * @param issues - Field paths and human-readable messages
   */
  constructor(readonly issues: ProtocolIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
    this.name = "ProtocolError";
  }
}
