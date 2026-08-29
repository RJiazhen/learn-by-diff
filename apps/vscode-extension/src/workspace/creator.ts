import {
  appendFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  COURSE_CONFIG_DIR,
  loadCourse,
  loadCourseFromConfigDir,
  type Course,
} from "@learn-by-diff/protocol";
import type { GitClient } from "../git/client.ts";
import { chapterSnapshotPaths, learningPaths } from "./paths.ts";
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
 * Clones the course repo, mirrors the source repo, exports chapter one, and writes `.learn`.
 *
 * The learning workspace GIT_DIR is a new repo for the student; it never points at the mirror.
 *
 * @param options - Clone URLs, destination, and git client
 * @returns Loaded course
 */
export async function createLearningWorkspace(
  options: CreateLearningWorkspaceOptions,
): Promise<CreatedLearningWorkspace> {
  const { courseRepoUrl, git, onLog, runInstall, inPlaceRoot, parentDir } = options;
  await git.ensureAvailable();
  onLog?.("Cloning course repository…");
  const courseCloneDir = await mkdtemp(path.join(tmpdir(), "learn-by-diff-course-"));
  try {
    await git.clone(courseRepoUrl, courseCloneDir);
    const preview = await loadCourse(courseCloneDir);
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
    await cp(path.join(courseCloneDir, COURSE_CONFIG_DIR), paths.courseDir, {
      recursive: true,
    });

    const course = await loadCourseFromConfigDir(paths.courseDir);

    onLog?.("Cloning source mirror…");
    await rm(paths.sourceMirror, { recursive: true, force: true });
    await git.cloneMirror(course.config.source.repository, paths.sourceMirror);

    const first = course.chapters[0];
    if (first === undefined) {
      throw new Error("course has no chapters");
    }
    await git.assertRef(paths.sourceMirror, first.fromRef);
    await git.assertRef(paths.sourceMirror, first.toRef);

    await clearStudentTree(learningRoot);
    onLog?.(`Exporting chapter ${first.id} (${first.fromRef})…`);
    await git.archive(paths.sourceMirror, first.fromRef, learningRoot);
    await ensureLearnGitignore(learningRoot);

    await writeProgress(learningRoot, { chapter: first.id, completed: false });

    const hasGit = await directoryExists(path.join(learningRoot, ".git"));
    if (!hasGit) {
      await git.initWithCommit(learningRoot, `LearnByDiff: start ${first.id}`);
    }

    if (runInstall) {
      onLog?.(`Running: ${course.config.workspace.install}`);
      await runInstall(course.config.workspace.install, learningRoot);
    }

    return { course, learningRoot };
  } finally {
    await rm(courseCloneDir, { recursive: true, force: true });
  }
}

/**
 * Exports from/to snapshots for a chapter (used by the diff editor).
 *
 * @param git - Git client
 * @param workspaceRoot - Learning repository root
 * @param chapterId - Chapter id
 * @param fromRef - Start tree-ish
 * @param toRef - Goal tree-ish
 */
export async function materializeChapterSnapshots(
  git: GitClient,
  workspaceRoot: string,
  chapterId: string,
  fromRef: string,
  toRef: string,
): Promise<{ fromDir: string; toDir: string }> {
  const { sourceMirror } = learningPaths(workspaceRoot);
  const { fromDir, toDir, chapterDir } = chapterSnapshotPaths(workspaceRoot, chapterId);
  await rm(chapterDir, { recursive: true, force: true });
  await git.archive(sourceMirror, fromRef, fromDir);
  await git.archive(sourceMirror, toRef, toDir);
  return { fromDir, toDir };
}

/**
 * Replaces the student tree with `fromRef` for `chapterId` and updates progress.
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
  await git.assertRef(sourceMirror, chapter.fromRef);
  await clearStudentTree(workspaceRoot);
  await git.archive(sourceMirror, chapter.fromRef, workspaceRoot);
  await writeProgress(workspaceRoot, { chapter: chapterId, completed: false });
}

/**
 * Deletes workspace files except `.git` and `.learn`.
 *
 * @param workspaceRoot - Learning repository root
 */
export async function clearStudentTree(workspaceRoot: string): Promise<void> {
  const entries = await readdir(workspaceRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === ".learn") {
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
 * Ensures `.learn/` is ignored so the source mirror is not committed by the student repo.
 *
 * @param workspaceRoot - Learning repository root
 */
async function ensureLearnGitignore(workspaceRoot: string): Promise<void> {
  const gitignorePath = path.join(workspaceRoot, ".gitignore");
  const extra = [".learn/", "node_modules/"];
  let existing = "";
  try {
    existing = await readFile(gitignorePath, "utf8");
  } catch {
    await writeFile(gitignorePath, `${extra.join("\n")}\n`, "utf8");
    return;
  }
  const lines = existing.split(/\r?\n/);
  const missing = extra.filter((rule) => !lines.some((line) => line.trim() === rule));
  if (missing.length === 0) {
    return;
  }
  const prefix = existing.endsWith("\n") || existing === "" ? "" : "\n";
  await appendFile(gitignorePath, `${prefix}${missing.join("\n")}\n`, "utf8");
}
