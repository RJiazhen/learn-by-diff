import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  COURSE_FILE_NAME,
  courseHomeDir,
  findCourseConfigDir,
  loadCourseFromConfigDir,
  ProtocolError,
  resolveSourceSubtreePath,
  type Course,
} from "@learn-by-diff/protocol";
import type { GitClient } from "../git/client.ts";
import { isCodeWorkspaceFileName, learningPaths } from "./paths.ts";
import { ensureLearningWorkspaceFile } from "./multiRoot.ts";
import { isRemoteGitUrl, localCourseOrigin, resolveSourceRepository } from "./resolveRepo.ts";
import {
  assertSourceSubtree,
  directoryExists,
  exportSourceSubtree,
  materializeSourceStore,
} from "./sourceStore.ts";
import { writeProgress, type ChapterSnapshotSide } from "./state.ts";

/** Options for creating a learning workspace from a `course.yml` path or git URL. */
export interface CreateLearningWorkspaceOptions {
  /** Local path to `course.yml` (`file:` URLs allowed) or a git URL to clone. */
  courseRepoUrl: string;
  git: GitClient;
  /** Initialize this folder in place (debug sandbox). */
  inPlaceRoot?: string;
  /** Parent directory; workspace becomes `{parent}/{course.id}`. */
  parentDir?: string;
  /** Optional logger for clone/materialize output. */
  onLog?: (line: string) => void;
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
  const { courseRepoUrl, git, onLog, inPlaceRoot, parentDir } = options;
  await git.ensureAvailable();

  const courseConfigSource = await resolveCourseConfigDir(git, courseRepoUrl, onLog);
  try {
    const preview = await loadCourseFromConfigDir(courseConfigSource.configDir);
    const courseHome = courseHomeDir(courseConfigSource.configDir);
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
    await copyCourseConfigFiles(
      courseConfigSource.configDir,
      paths.courseDir,
      preview.config.chaptersDir,
    );

    const course = await loadCourseFromConfigDir(paths.courseDir);

    const sourceRepository = resolveSourceRepository(course.config.source.repository, courseHome);
    await materializeSourceStore(git, sourceRepository, paths.sourceMirror, onLog);

    const first = course.chapters[0];
    if (first === undefined) {
      throw new Error("course has no chapters");
    }
    const fromSubtree = resolveSourceSubtreePath(course.config.source, first.fromDir);
    const toSubtree = resolveSourceSubtreePath(course.config.source, first.toDir);
    if (fromSubtree !== undefined) {
      await assertSourceSubtree(git, paths.sourceMirror, fromSubtree);
    }
    if (toSubtree !== undefined) {
      await assertSourceSubtree(git, paths.sourceMirror, toSubtree);
    }

    onLog?.(
      `Exporting chapter ${first.id} (${fromSubtree === undefined ? "∅" : `${fromSubtree}/`})…`,
    );
    await replaceStudentTreeFromSource(git, learningRoot, paths.sourceMirror, fromSubtree);

    await writeProgress(learningRoot, {
      chapter: first.id,
      completed: false,
      appliedSide: "start",
    });

    await ensureLearningWorkspaceFile(learningRoot);

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
 * Resolves course config from a local `course.yml` path or by cloning a git course repository.
 *
 * Local inputs must be the `course.yml` file (or a `file:` URL to it), not a directory.
 * Remote git URLs are cloned, then `course.yml` is found at the clone root or under `.course-config/`.
 *
 * @param git - Git client
 * @param courseRepoUrl - User-supplied `course.yml` path or git URL
 * @param onLog - Optional progress logger
 */
async function resolveCourseConfigDir(
  git: GitClient,
  courseRepoUrl: string,
  onLog?: (line: string) => void,
): Promise<CourseConfigSource> {
  const local = localCourseOrigin(courseRepoUrl);
  if (local !== undefined) {
    const localConfig = await resolveLocalCourseYml(local);
    if (localConfig !== undefined) {
      onLog?.(`Using local course config… (${local})`);
      return localConfig;
    }
    if (!isRemoteGitUrl(courseRepoUrl)) {
      throw new Error(`course.yml not found: ${courseRepoUrl}`);
    }
  }

  if (!isRemoteGitUrl(courseRepoUrl) && local === undefined) {
    throw new Error(`course.yml not found: ${courseRepoUrl}`);
  }

  onLog?.("Cloning course repository…");
  const courseCloneDir = await mkdtemp(path.join(tmpdir(), "learn-by-diff-course-"));
  try {
    await git.clone(courseRepoUrl, courseCloneDir);
    const configDir = await findCourseConfigDir(courseCloneDir);
    if (configDir === undefined) {
      throw new ProtocolError([
        {
          path: COURSE_FILE_NAME,
          message:
            "course config file was not found (looked in course.yml, then .course-config/course.yml)",
        },
      ]);
    }
    return {
      configDir,
      cleanup: async () => {
        await rm(courseCloneDir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await rm(courseCloneDir, { recursive: true, force: true });
    throw error;
  }
}

/**
 * Resolves a local filesystem path to the directory that contains `course.yml`.
 *
 * Directories are rejected so Open Course always takes an explicit file.
 *
 * @param local - Absolute filesystem path from {@link localCourseOrigin}
 * @returns Config source, or `undefined` when the path does not exist
 */
async function resolveLocalCourseYml(local: string): Promise<CourseConfigSource | undefined> {
  let info: Awaited<ReturnType<typeof stat>>;
  try {
    info = await stat(local);
  } catch {
    return undefined;
  }
  if (info.isFile()) {
    if (path.basename(local) !== COURSE_FILE_NAME) {
      throw new Error(`expected ${COURSE_FILE_NAME} file: ${local}`);
    }
    return { configDir: path.dirname(local), cleanup: async () => {} };
  }
  if (info.isDirectory()) {
    throw new Error(`provide the ${COURSE_FILE_NAME} file path, not a directory: ${local}`);
  }
  return undefined;
}

/**
 * Copies `course.yml` and the configured chapters directory into the learning workspace.
 *
 * Does not copy the rest of a course-home tree (source files, git metadata).
 *
 * @param fromConfigDir - Directory that contains `course.yml`
 * @param toConfigDir - `.learn/course` destination
 * @param chaptersDir - Posix-relative chapters directory from `course.yml`
 */
async function copyCourseConfigFiles(
  fromConfigDir: string,
  toConfigDir: string,
  chaptersDir: string,
): Promise<void> {
  await mkdir(toConfigDir, { recursive: true });
  await cp(path.join(fromConfigDir, COURSE_FILE_NAME), path.join(toConfigDir, COURSE_FILE_NAME));
  const fromChapters = joinConfigRelative(fromConfigDir, chaptersDir);
  if (await directoryExists(fromChapters)) {
    const toChapters = joinConfigRelative(toConfigDir, chaptersDir);
    await mkdir(path.dirname(toChapters), { recursive: true });
    await cp(fromChapters, toChapters, { recursive: true });
  }
}

/**
 * Joins a posix-relative path onto a config directory as a filesystem path.
 *
 * @param configDir - Directory that contains `course.yml`
 * @param relativePosix - Slash-separated path under the config directory
 */
function joinConfigRelative(configDir: string, relativePosix: string): string {
  return path.join(configDir, ...relativePosix.split("/").filter((segment) => segment !== ""));
}

/**
 * Replaces the student tree with a chapter start (`fromDir`) or finish (`toDir`).
 *
 * Preserves the workspace `.gitignore` across the export so regenerable `.learn`
 * paths stay ignored and course config under `.learn/course` remains commit-able.
 *
 * @param git - Git client
 * @param workspaceRoot - Learning repository root
 * @param course - Loaded course
 * @param chapterId - Target chapter
 * @param side - Snapshot to export
 */
export async function checkoutChapter(
  git: GitClient,
  workspaceRoot: string,
  course: Course,
  chapterId: string,
  side: ChapterSnapshotSide = "start",
): Promise<void> {
  const chapter = course.chapters.find((item) => item.id === chapterId);
  if (chapter === undefined) {
    throw new Error(`unknown chapter: ${chapterId}`);
  }
  const snapshotDir = side === "finish" ? chapter.toDir : chapter.fromDir;
  const { sourceMirror } = learningPaths(workspaceRoot);
  await replaceStudentTreeFromSource(
    git,
    workspaceRoot,
    sourceMirror,
    resolveSourceSubtreePath(course.config.source, snapshotDir),
  );
  await writeProgress(workspaceRoot, {
    chapter: chapterId,
    completed: false,
    appliedSide: side,
  });
}

/**
 * Clears the student tree and exports `subdir`, preserving any existing `.gitignore`.
 *
 * Chapter snapshots may include a `.gitignore`; that must not replace the learner's
 * file. Learn-related ignore rules are merged afterward via {@link ensureLearnGitignore}.
 * When `subdir` is `undefined`, the workspace is cleared to an empty tree (empty fromDir).
 *
 * @param git - Git client
 * @param workspaceRoot - Learning workspace root
 * @param sourceStore - Materialized source store
 * @param subdir - Chapter directory to export, or `undefined` for an empty start
 */
async function replaceStudentTreeFromSource(
  git: GitClient,
  workspaceRoot: string,
  sourceStore: string,
  subdir: string | undefined,
): Promise<void> {
  const preservedGitignore = await readGitignore(workspaceRoot);
  await clearStudentTree(workspaceRoot);
  await exportSourceSubtree(git, sourceStore, subdir, workspaceRoot);
  if (preservedGitignore !== undefined) {
    await writeFile(path.join(workspaceRoot, ".gitignore"), preservedGitignore, "utf8");
  }
  await ensureLearnGitignore(workspaceRoot);
}

/**
 * Deletes workspace files except `.git`, `.learn`, `.gitignore`, and `.code-workspace`.
 *
 * Chapter docs such as `README.md` are snapshot content and must be removed so
 * the next export is a replace, not a merge with the previous chapter. The
 * multi-root workspace file must stay so Open Recent can restore extra folders.
 *
 * @param workspaceRoot - Learning repository root
 */
async function clearStudentTree(workspaceRoot: string): Promise<void> {
  const entries = await readdir(workspaceRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (
      entry.name === ".git" ||
      entry.name === ".learn" ||
      entry.name === ".gitignore" ||
      isCodeWorkspaceFileName(entry.name)
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
const LEARN_GITIGNORE_RULES = [
  ".learn/source.git/",
  ".learn/snapshots/",
  ".learn/refs/",
  "*.code-workspace",
  "node_modules/",
];

/**
 * Ensures regenerable `.learn` paths and `node_modules/` are ignored.
 *
 * Does not ignore `.learn/course` or `.learn/progress.json`, so learners can commit
 * course config (and progress) and reopen the same repo later. Removes a legacy
 * blanket `.learn/` rule and `.learn/*.code-workspace` when present.
 *
 * @param workspaceRoot - Learning repository root
 */
export async function ensureLearnGitignore(workspaceRoot: string): Promise<void> {
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
    return trimmed !== ".learn/" && trimmed !== ".learn" && trimmed !== ".learn/*.code-workspace";
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
