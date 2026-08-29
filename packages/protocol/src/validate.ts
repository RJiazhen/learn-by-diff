import type { ChapterConfig, Course, CourseConfig, ProtocolIssue } from "./types.ts";
import { PROTOCOL_VERSION, ProtocolError } from "./types.ts";

/**
 * Validates a parsed course and its chapters; throws {@link ProtocolError} on failure.
 *
 * Does not talk to Git. Remote refs are checked later by the extension.
 *
 * @param config - Parsed `course.yml`
 * @param chapters - Parsed chapter documents
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
  requireNonEmpty(issues, "course.yml#workspace.install", config.workspace.install);
  requireNonEmpty(issues, "course.yml#workspace.dev", config.workspace.dev);
  requireNonEmpty(issues, "course.yml#workspace.test", config.workspace.test);
}

/**
 * Collects chapter-level issues, including duplicate ids.
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
    requireNonEmpty(issues, `${prefix}.fromRef`, chapter.fromRef);
    requireNonEmpty(issues, `${prefix}.toRef`, chapter.toRef);
    requireNonEmptyPaths(issues, `${prefix}.entryFiles`, chapter.entryFiles);
    requireNonEmptyPaths(issues, `${prefix}.tests`, chapter.tests);

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
 * Pushes issues when the list is empty or contains a blank path.
 */
function requireNonEmptyPaths(issues: ProtocolIssue[], path: string, values: string[]): void {
  if (values.length === 0) {
    issues.push({ path, message: "must contain at least one path" });
    return;
  }
  for (const [index, value] of values.entries()) {
    if (value.trim() === "") {
      issues.push({
        path: `${path}[${String(index)}]`,
        message: "must not be empty",
      });
    }
  }
}
