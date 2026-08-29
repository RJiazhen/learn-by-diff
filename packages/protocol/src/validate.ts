import type { ChapterConfig, Course, CourseConfig, ProtocolIssue } from "./types.ts";
import { PROTOCOL_VERSION, ProtocolError } from "./types.ts";
import { normalizeSourceDirPath } from "./sourcePath.ts";

/**
 * Validates a parsed course and its chapters; throws {@link ProtocolError} on failure.
 *
 * Does not talk to Git. Source subdirectory existence is checked later by the extension.
 *
 * @param config - Parsed `course.yml`
 * @param chapters - Parsed chapter documents (defaults already applied)
 * @param configDir - `.course-config` directory, used in issue paths
 */
export function validateCourse(
  config: CourseConfig,
  chapters: ChapterConfig[],
  configDir: string,
): Course {
  const issues: ProtocolIssue[] = [];
  validateCourseConfig(config, issues);
  validateChapters(chapters, issues);

  if (issues.length > 0) {
    throw new ProtocolError(issues);
  }

  return { config, chapters, configDir };
}

/**
 * Collects `course.yml` field issues into `issues`.
 */
function validateCourseConfig(config: CourseConfig, issues: ProtocolIssue[]): void {
  if (config.protocolVersion !== PROTOCOL_VERSION) {
    issues.push({
      path: "course.yml#protocolVersion",
      message: `unsupported protocolVersion ${String(config.protocolVersion)}; expected ${String(PROTOCOL_VERSION)}`,
    });
  }
  requireNonEmpty(issues, "course.yml#id", config.id);
  requireNonEmpty(issues, "course.yml#title", config.title);
  requireNonEmpty(issues, "course.yml#source.repository", config.source.repository);
  if (config.source.root !== undefined && config.source.root.trim() !== "") {
    requireSourceDirPath(issues, "course.yml#source.root", config.source.root);
  }
  requireNonEmpty(issues, "course.yml#workspace.install", config.workspace.install);
  requireNonEmpty(issues, "course.yml#workspace.dev", config.workspace.dev);
  requireNonEmpty(issues, "course.yml#workspace.test", config.workspace.test);
}

/**
 * Collects chapter-level issues (ids unique; optional dirs/paths when present).
 */
function validateChapters(chapters: ChapterConfig[], issues: ProtocolIssue[]): void {
  if (chapters.length === 0) {
    issues.push({
      path: "chapters/",
      message: "at least one chapter yaml is required",
    });
    return;
  }

  const seenIds = new Set<string>();
  for (const [index, chapter] of chapters.entries()) {
    const prefix = `chapters[${String(index)}]`;
    requireNonEmpty(issues, `${prefix}.id`, chapter.id);
    requireNonEmpty(issues, `${prefix}.title`, chapter.title);
    if (chapter.fromDir.trim() !== "") {
      requireSourceDirPath(issues, `${prefix}.fromDir`, chapter.fromDir);
    }
    if (chapter.toDir.trim() !== "") {
      requireSourceDirPath(issues, `${prefix}.toDir`, chapter.toDir);
    }
    if (chapter.entryFiles !== undefined) {
      for (const [fileIndex, value] of chapter.entryFiles.entries()) {
        if (value.trim() === "") {
          issues.push({
            path: `${prefix}.entryFiles[${String(fileIndex)}]`,
            message: "must not be empty",
          });
        }
      }
    }

    if (chapter.id !== "" && seenIds.has(chapter.id)) {
      issues.push({
        path: `${prefix}.id`,
        message: `duplicate chapter id "${chapter.id}"`,
      });
    }
    if (chapter.id !== "") {
      seenIds.add(chapter.id);
    }
  }
}

/**
 * Pushes an issue when `value` is empty or whitespace.
 */
function requireNonEmpty(issues: ProtocolIssue[], path: string, value: string): void {
  if (value.trim() === "") {
    issues.push({ path, message: "must not be empty" });
  }
}

/**
 * Pushes an issue when `value` is not a safe source-repo-relative directory path.
 */
function requireSourceDirPath(issues: ProtocolIssue[], path: string, value: string): void {
  if (normalizeSourceDirPath(value) === undefined) {
    issues.push({
      path,
      message:
        "must be a relative directory path under the source repo (nested dirs allowed; no '..' or absolute paths)",
    });
  }
}
