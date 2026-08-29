/** Directory name for course protocol files at a repository root. */
export const COURSE_CONFIG_DIR = ".course-config";

/** Filename of the course-level protocol document. */
export const COURSE_FILE_NAME = "course.yml";

/** Directory of per-chapter protocol documents under the course config dir. */
export const CHAPTERS_DIR_NAME = "chapters";

/** Source repository pointer in `course.yml`. */
export interface CourseSource {
  /** Git URL or path to the source repository (relative paths resolve from the course repo). */
  repository: string;
  /**
   * Optional subdirectory under `repository` that prefixes every chapter `fromDir` / `toDir`.
   * Use this when course snapshots live under one monorepo folder (e.g. `learn/demo`).
   */
  root?: string;
}

/**
 * Parsed `course.yml` document (after load-time defaults).
 *
 * No field is required in the YAML file. Defaults:
 * - `id` ← parent dir of `.course-config`, or `{repoName}-learn` when that parent is a git root
 * - `title` ← `id`
 * - `source.repository` ← `.` (course home directory containing `.course-config`)
 *
 * Protocol evolves by adding optional fields only; there is no `protocolVersion` gate.
 */
export interface CourseConfig {
  id: string;
  title: string;
  source: CourseSource;
}

/**
 * Parsed chapter yaml document (after load-time defaults).
 *
 * No field is required in the YAML file. Defaults:
 * - `id` ← filename without numeric prefix (`001-hello.yml` → `hello`)
 * - `title` ← `id`
 * - `fromDir` / `toDir` ← `""` (empty snapshot tree)
 * - `entryFiles` ← omitted means discover all files under `toDir` at runtime
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
   * Optional chapter documentation: an `http(s)` URL, or a file path relative to the
   * chapter snapshot tree (`toDir`, then `fromDir`) such as `README.md` or `notes/guide.pdf`.
   */
  docs?: string;
}

/** Fully loaded course: root config plus chapters in file-name order. */
export interface Course {
  config: CourseConfig;
  chapters: ChapterConfig[];
  /** Absolute path to the `.course-config` directory that was loaded. */
  configDir: string;
}

/** One field-level validation failure. */
export interface ProtocolIssue {
  path: string;
  message: string;
}

/** Thrown when YAML cannot be parsed or fails protocol validation. */
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
