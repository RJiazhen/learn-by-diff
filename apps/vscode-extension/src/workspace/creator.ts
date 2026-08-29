import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { COURSE_CONFIG_DIR, loadCourseFromConfigDir, type Course } from "@learn-by-diff/protocol";
import type { GitClient } from "../git/client.ts";
import { chapterSnapshotPaths, learningPaths } from "./paths.ts";
import { isRemoteGitUrl, localCourseOrigin, resolveSourceRepository } from "./resolveRepo.ts";
import { assertSourceSubtree, exportSourceSubtree, materializeSourceStore } from "./sourceStore.ts";
import { writeProgress } from "./state.ts";

/** Options for creating a learning workspace from a course repository URL. */
export interface CreateLearningWorkspaceOptions {
  courseRepoUrl: string;
  git: GitClient;
  /** Initialize this folder in place (debug sandbox). */
  inPlaceRoot?: string;
  /** Parent directory; workspace becomes `{parent}/{course.id}`. */
  parentDir?: string;
  /** Optional logger for clone/install output. */
  onLog?: (line: string) => void;
  /** Runs the course `workspace.install` command in the learning root. */
  runInstall?: (command: string, cwd: string) => Promise<void>;
}

/** Result of {@link createLearningWorkspace}. */
export interface CreatedLearningWorkspace {
  course: Course;
  learningRoot: string;
}

/**
 * Loads course config into `.learn/course`, materializes source, exports chapter one.
 *
 * Local course/source directories (including committed `examples/`) do not need nested git.
 * The learning workspace GIT_DIR is a new repo for the student; it never points at the source store.
 *
 * @param options - Clone URLs, destination, and git client
 * @returns Loaded course
 */
export async function createLearningWorkspace(
  options: CreateLearningWorkspaceOptions,
): Promise<CreatedLearningWorkspace> {
  const { courseRepoUrl, git, onLog, runInstall, inPlaceRoot, parentDir } = options;
  await git.ensureAvailable();

  const courseConfigSource = await resolveCourseConfigDir(git, courseRepoUrl, onLog);
  try {
    const preview = await loadCourseFromConfigDir(courseConfigSource.configDir);
    const learningRoot =
      inPlaceRoot ??
      (parentDir !== undefined ? path.join(parentDir, preview.config.id) : undefined);
    if (learningRoot === undefined) {
      throw new Error("createLearningWorkspace requires inPlaceRoot or parentDir");
    }
    await mkdir(learningRoot, { recursive: true });

    const paths = learningPaths(learningRoot);
    await mkdir(paths.learnDir, { recursive: true });
    await rm(paths.courseDir, { recursive: true, force: true });
    await cp(courseConfigSource.configDir, paths.courseDir, { recursive: true });

    const course = await loadCourseFromConfigDir(paths.courseDir);

    const sourceRepository = resolveSourceRepository(
      course.config.source.repository,
      courseRepoUrl,
    );
    await materializeSourceStore(git, sourceRepository, paths.sourceMirror, onLog);

    const first = course.chapters[0];
    if (first === undefined) {
      throw new Error("course has no chapters");
    }
    await assertSourceSubtree(git, paths.sourceMirror, first.fromDir);
    await assertSourceSubtree(git, paths.sourceMirror, first.toDir);

    await clearStudentTree(learningRoot);
    onLog?.(`Exporting chapter ${first.id} (${first.fromDir}/)…`);
    await exportSourceSubtree(git, paths.sourceMirror, first.fromDir, learningRoot);
    await ensureLearnGitignore(learningRoot);

    await writeProgress(learningRoot, { chapter: first.id, completed: false });

    if (runInstall) {
      onLog?.(`Running: ${course.config.workspace.install}`);
      await runInstall(course.config.workspace.install, learningRoot);
    }

    return { course, learningRoot };
  } finally {
    await courseConfigSource.cleanup();
  }
}

/** Temporary or in-place course config directory used while creating a workspace. */
interface CourseConfigSource {
  configDir: string;
  cleanup: () => Promise<void>;
}

/**
 * Resolves `.course-config` from a local path or by cloning a git course repository.
 *
 * @param git - Git client
 * @param courseRepoUrl - User-supplied course URL or path
 * @param onLog - Optional progress logger
 */
async function resolveCourseConfigDir(
  git: GitClient,
  courseRepoUrl: string,
  onLog?: (line: string) => void,
): Promise<CourseConfigSource> {
  const local = localCourseOrigin(courseRepoUrl);
  if (local !== undefined) {
    const configDir = path.join(local, COURSE_CONFIG_DIR);
    if (await directoryExists(configDir)) {
      onLog?.(`Using local course config… (${local})`);
      return { configDir, cleanup: async () => {} };
    }
  }

  if (!isRemoteGitUrl(courseRepoUrl) && local === undefined) {
    throw new Error(`course repository not found: ${courseRepoUrl}`);
  }

  onLog?.("Cloning course repository…");
  const courseCloneDir = await mkdtemp(path.join(tmpdir(), "learn-by-diff-course-"));
  await git.clone(courseRepoUrl, courseCloneDir);
  return {
    configDir: path.join(courseCloneDir, COURSE_CONFIG_DIR),
    cleanup: async () => {
      await rm(courseCloneDir, { recursive: true, force: true });
    },
  };
}

/**
 * Exports from/to chapter directory snapshots for the diff editor.
 *
 * @param git - Git client
 * @param workspaceRoot - Learning repository root
 * @param chapterId - Chapter id
 * @param fromDir - Start subdirectory in the source repo
 * @param toDir - Goal subdirectory in the source repo
 */
export async function materializeChapterSnapshots(
  git: GitClient,
  workspaceRoot: string,
  chapterId: string,
  fromDir: string,
  toDir: string,
): Promise<{ fromDir: string; toDir: string }> {
  const { sourceMirror } = learningPaths(workspaceRoot);
  const paths = chapterSnapshotPaths(workspaceRoot, chapterId);
  await rm(paths.chapterDir, { recursive: true, force: true });
  await exportSourceSubtree(git, sourceMirror, fromDir, paths.fromDir);
  await exportSourceSubtree(git, sourceMirror, toDir, paths.toDir);
  return { fromDir: paths.fromDir, toDir: paths.toDir };
}

/**
 * Replaces the student tree with `fromDir` for `chapterId` and updates progress.
 *
 * Preserves the workspace `.gitignore` across the export so regenerable `.learn`
 * paths stay ignored and course config under `.learn/course` remains commit-able.
 *
 * @param git - Git client
 * @param workspaceRoot - Learning repository root
 * @param course - Loaded course
 * @param chapterId - Target chapter
 */
export async function checkoutChapter(
  git: GitClient,
  workspaceRoot: string,
  course: Course,
  chapterId: string,
): Promise<void> {
  const chapter = course.chapters.find((item) => item.id === chapterId);
  if (chapter === undefined) {
    throw new Error(`unknown chapter: ${chapterId}`);
  }
  const { sourceMirror } = learningPaths(workspaceRoot);
  const preservedGitignore = await readGitignore(workspaceRoot);
  await clearStudentTree(workspaceRoot);
  await exportSourceSubtree(git, sourceMirror, chapter.fromDir, workspaceRoot);
  if (preservedGitignore !== undefined) {
    await writeFile(path.join(workspaceRoot, ".gitignore"), preservedGitignore, "utf8");
  }
  await ensureLearnGitignore(workspaceRoot);
  await writeProgress(workspaceRoot, { chapter: chapterId, completed: false });
}

/**
 * Deletes workspace files except `.git`, `.learn`, `README.md`, and `.gitignore`.
 *
 * @param workspaceRoot - Learning repository root
 */
export async function clearStudentTree(workspaceRoot: string): Promise<void> {
  const entries = await readdir(workspaceRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (
      entry.name === ".git" ||
      entry.name === ".learn" ||
      entry.name === "README.md" ||
      entry.name === ".gitignore"
    ) {
      continue;
    }
    await rm(path.join(workspaceRoot, entry.name), {
      recursive: true,
      force: true,
    });
  }
}

/**
 * Returns whether `dir` exists and is a directory.
 */
async function directoryExists(dir: string): Promise<boolean> {
  try {
    return (await stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Reads the workspace `.gitignore`, or `undefined` when missing.
 *
 * @param workspaceRoot - Learning repository root
 */
async function readGitignore(workspaceRoot: string): Promise<string | undefined> {
  try {
    return await readFile(path.join(workspaceRoot, ".gitignore"), "utf8");
  } catch {
    return undefined;
  }
}

/** Ignore rules for regenerable `.learn` data; course config and progress stay trackable. */
const LEARN_GITIGNORE_RULES = [".learn/source.git/", ".learn/snapshots/", "node_modules/"];

/**
 * Ensures regenerable `.learn` paths and `node_modules/` are ignored.
 *
 * Does not ignore `.learn/course` or `.learn/progress.json`, so learners can commit
 * course config (and progress) and reopen the same repo later. Removes a legacy
 * blanket `.learn/` rule when present.
 *
 * @param workspaceRoot - Learning repository root
 */
async function ensureLearnGitignore(workspaceRoot: string): Promise<void> {
  const gitignorePath = path.join(workspaceRoot, ".gitignore");
  let lines: string[];
  try {
    lines = (await readFile(gitignorePath, "utf8")).split(/\r?\n/);
  } catch {
    await writeFile(gitignorePath, `${LEARN_GITIGNORE_RULES.join("\n")}\n`, "utf8");
    return;
  }

  const withoutObsolete = lines.filter((line) => {
    const trimmed = line.trim();
    return trimmed !== ".learn/" && trimmed !== ".learn";
  });
  const missing = LEARN_GITIGNORE_RULES.filter(
    (rule) => !withoutObsolete.some((line) => line.trim() === rule),
  );
  if (missing.length === 0 && withoutObsolete.length === lines.length) {
    return;
  }

  let content = withoutObsolete.join("\n");
  if (content !== "" && !content.endsWith("\n")) {
    content += "\n";
  }
  if (missing.length > 0) {
    content += `${missing.join("\n")}\n`;
  }
  await writeFile(gitignorePath, content, "utf8");
}
