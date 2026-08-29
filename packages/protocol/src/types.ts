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
  repository: string;
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

/** Parsed chapter yaml document. */
export interface ChapterConfig {
  id: string;
  title: string;
  /** Source subdirectory for the chapter start snapshot (e.g. `start`). */
  fromDir: string;
  /** Source subdirectory for the chapter goal snapshot (e.g. `hello`). */
  toDir: string;
  entryFiles: string[];
  tests: string[];
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
