/** Directory name for course protocol files at a repository root. */
export const COURSE_CONFIG_DIR = ".course-config";

/** Filename of the course-level protocol document. */
export const COURSE_FILE_NAME = "course.yml";

/** Directory of per-chapter protocol documents under the course config dir. */
export const CHAPTERS_DIR_NAME = "chapters";

/** Supported Learning Course Protocol version. */
export const PROTOCOL_VERSION = 1;

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

/** Install, dev, and test commands declared for the learning workspace. */
export interface CourseWorkspace {
  install: string;
  dev: string;
  test: string;
}

/** Parsed `course.yml` document. */
export interface CourseConfig {
  protocolVersion: number;
  id: string;
  title: string;
  source: CourseSource;
  workspace: CourseWorkspace;
}

/**
 * Parsed chapter yaml document (after load-time defaults).
 *
 * No field is required in the YAML file. Defaults:
 * - `id` ← filename without numeric prefix (`001-hello.yml` → `hello`)
 * - `title` ← `id`
 * - `fromDir` / `toDir` ← `""` (empty snapshot tree)
 * - `entryFiles` ← omitted means discover all files under `toDir` at runtime
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
