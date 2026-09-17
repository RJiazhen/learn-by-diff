import type {
  ChapterChangedFile,
  ChapterConfig,
  Course,
  CourseConfig,
  ProtocolIssue,
} from "./types.ts";
import { isChapterChangeKind, ProtocolError } from "./types.ts";
import { isHttpUrl, normalizeRelativeFilePath, normalizeSourceDirPath } from "./sourcePath.ts";

/**
 * Validates a parsed course and its chapters; throws {@link ProtocolError} on failure.
 *
 * Does not talk to Git. Source subdirectory existence is checked later by the extension.
 *
 * @param config - Parsed `course.yml` (defaults already applied)
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
  validateChapters(chapters, issues, config.chaptersDir);

  if (issues.length > 0) {
    throw new ProtocolError(issues);
  }

  return { config, chapters, configDir };
}

/**
 * Collects `course.yml` field issues into `issues` (after defaults).
 */
function validateCourseConfig(config: CourseConfig, issues: ProtocolIssue[]): void {
  requireNonEmpty(issues, "course.yml#id", config.id);
  requireNonEmpty(issues, "course.yml#title", config.title);
  requireNonEmpty(issues, "course.yml#source.repository", config.source.repository);
  requireSourceDirPath(issues, "course.yml#chaptersDir", config.chaptersDir);
  if (config.source.root !== undefined && config.source.root.trim() !== "") {
    requireSourceDirPath(issues, "course.yml#source.root", config.source.root);
  }
}

/**
 * Collects chapter-level issues (ids unique; optional dirs/paths when present).
 *
 * @param chapters - Parsed chapter documents
 * @param issues - Accumulator
 * @param chaptersDir - Relative chapters directory from `course.yml` (for empty-list errors)
 */
function validateChapters(
  chapters: ChapterConfig[],
  issues: ProtocolIssue[],
  chaptersDir: string,
): void {
  if (chapters.length === 0) {
    issues.push({
      path: `${chaptersDir}/`,
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
    if (chapter.changedFiles !== undefined) {
      validateChangedFiles(issues, `${prefix}.changedFiles`, chapter.changedFiles);
    }
    if (chapter.docs !== undefined && chapter.docs.trim() !== "") {
      requireDocsRef(issues, `${prefix}.docs`, chapter.docs);
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
 * Collects issues for an author-declared from/to changed-file list.
 *
 * @param issues - Accumulator
 * @param prefix - Field path prefix (`chapters[n].changedFiles`)
 * @param files - Parsed `changedFiles` rows
 */
function validateChangedFiles(
  issues: ProtocolIssue[],
  prefix: string,
  files: readonly ChapterChangedFile[],
): void {
  const seenPaths = new Set<string>();
  for (const [fileIndex, file] of files.entries()) {
    const itemPath = `${prefix}[${String(fileIndex)}]`;
    if (file.path.trim() === "") {
      issues.push({ path: `${itemPath}.path`, message: "must not be empty" });
    } else {
      const normalized = normalizeRelativeFilePath(file.path);
      if (normalized === undefined) {
        issues.push({
          path: `${itemPath}.path`,
          message:
            "must be a relative file path under the chapter snapshot (no '..' or absolute paths)",
        });
      } else if (seenPaths.has(normalized)) {
        issues.push({
          path: `${itemPath}.path`,
          message: `duplicate changed file path "${normalized}"`,
        });
      } else {
        seenPaths.add(normalized);
      }
    }
    if (!isChapterChangeKind(file.kind)) {
      issues.push({
        path: `${itemPath}.kind`,
        message: 'must be "U", "M", or "D"',
      });
    }
  }
}

/**
 * Pushes an issue when `value` is empty or whitespace.
 *
 * @param issues - Accumulator
 * @param path - Field path for the issue
 * @param value - Candidate string
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

/**
 * Pushes an issue when `value` is neither an http(s) URL nor a safe relative file path.
 */
function requireDocsRef(issues: ProtocolIssue[], path: string, value: string): void {
  if (isHttpUrl(value)) {
    return;
  }
  if (normalizeRelativeFilePath(value) === undefined) {
    issues.push({
      path,
      message:
        "must be an http(s) URL or a relative file path under the chapter snapshot (no '..' or absolute paths)",
    });
  }
}
