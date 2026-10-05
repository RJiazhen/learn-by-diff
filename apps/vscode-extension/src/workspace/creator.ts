import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  COURSE_FILE_NAME,
  findCourseConfigDir,
  loadCourseFromConfigDir,
  ProtocolError,
  type Course,
} from "@learn-by-diff/protocol";
import type { GitClient } from "../git/client.ts";
import { writeChapterArchives } from "../snapshot/archive.ts";
import { isEmptyLearningTarget } from "./emptyTarget.ts";
import { NonEmptyLearningTargetError } from "./errors.ts";
import { learningPaths } from "./paths.ts";
import { ensureBuiltinRetain, prunePathsOutsideSnapshot } from "./retain.ts";
import { ensureLearningWorkspaceFile } from "./multiRoot.ts";
import { githubCloneBranch, parseCourseConfigUrl } from "./parseCourseConfigUrl.ts";
import { describeCourseOrigin, writeCourseOrigin } from "./courseOrigin.ts";
import { isRemoteGitUrl, localCourseOrigin, resolveSourceRepository } from "./resolveRepo.ts";
import {
  directoryExists,
  materializeSourceStore,
  overlayDirectoryChildren,
} from "./sourceStore.ts";
import { writeProgress, type ChapterSnapshotSide } from "./state.ts";

/** Options for creating a learning workspace from a `course.jsonc` path or git URL. */
export interface CreateLearningWorkspaceOptions {
  /** Local `course.jsonc` path (`file:` URLs allowed), GitHub file URL, or git URL to clone. */
  courseRepoUrl: string;
  git: GitClient;
  /** Initialize this folder in place when it is empty (debug sandbox). */
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
 * Throws {@link NonEmptyLearningTargetError} instead of replacing files in a non-empty destination.
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
    const learningRoot =
      inPlaceRoot ??
      (parentDir !== undefined ? path.join(parentDir, preview.config.id) : undefined);
    if (learningRoot === undefined) {
      throw new Error("createLearningWorkspace requires inPlaceRoot or parentDir");
    }
    if (!(await isEmptyLearningTarget(learningRoot))) {
      throw new NonEmptyLearningTargetError(learningRoot);
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
    await ensureBuiltinRetain(paths.courseDir);

    const course = await loadCourseFromConfigDir(paths.courseDir);
    await installCourseSourceAndFirstChapter(
      git,
      learningRoot,
      course,
      courseConfigSource.configDir,
      onLog,
    );
    await writeCourseOrigin(
      learningRoot,
      await describeCourseOrigin(git, courseRepoUrl, courseConfigSource.configDir),
    );

    await ensureLearningWorkspaceFile(learningRoot);

    return { course, learningRoot };
  } finally {
    await courseConfigSource.cleanup();
  }
}

/**
 * Clones or copies the course source and exports chapter 1 into the student tree.
 *
 * `sourceConfigDir` resolves a relative `source.repository`. `.` is the directory
 * that contained the original `course.jsonc`. Writes `.learn/progress.json`.
 *
 * @param git - Git client
 * @param workspaceRoot - Learning repository root
 * @param course - Loaded course whose config is already under `.learn/course`
 * @param sourceConfigDir - Directory used to resolve a relative source repository
 * @param onLog - Optional progress logger
 */
export async function installCourseSourceAndFirstChapter(
  git: GitClient,
  workspaceRoot: string,
  course: Course,
  sourceConfigDir: string,
  onLog?: (line: string) => void,
): Promise<void> {
  await materializeCourseSource(git, workspaceRoot, course, sourceConfigDir, onLog);
  await applyFirstChapterStart(git, workspaceRoot, course, onLog);
}

/**
 * Clones or copies the course source into `.learn/source-clone`.
 *
 * Does not export the student tree or write progress. Call
 * {@link applyFirstChapterStart} when chapter 1 is ready.
 *
 * @param git - Git client
 * @param workspaceRoot - Learning repository root
 * @param course - Course whose `source.repository` to materialize
 * @param sourceConfigDir - Directory used to resolve a relative source repository
 * @param onLog - Optional progress logger
 */
export async function materializeCourseSource(
  git: GitClient,
  workspaceRoot: string,
  course: Course,
  sourceConfigDir: string,
  onLog?: (line: string) => void,
): Promise<void> {
  const paths = learningPaths(workspaceRoot);
  const sourceRepository = resolveSourceRepository(
    course.config.source.repository,
    sourceConfigDir,
  );
  await materializeSourceStore(git, sourceRepository, paths.sourceMirror, onLog);
}

/**
 * Exports chapter 1 into the student tree and writes `.learn/progress.json`.
 *
 * Requires {@link materializeCourseSource} first. Copies the cached start snapshot
 * after extracting it from the source clone, so the student tree is not read
 * from the clone itself.
 *
 * @param git - Git client
 * @param workspaceRoot - Learning repository root
 * @param course - Course that includes at least chapter 1
 * @param onLog - Optional progress logger
 */
export async function applyFirstChapterStart(
  git: GitClient,
  workspaceRoot: string,
  course: Course,
  onLog?: (line: string) => void,
): Promise<void> {
  const paths = learningPaths(workspaceRoot);
  const first = course.chapters[0];
  if (first === undefined) {
    throw new Error("course has no chapters");
  }
  onLog?.(`Exporting chapter ${first.id}…`);
  const archives = await writeChapterArchives(
    git,
    paths.sourceMirror,
    workspaceRoot,
    first.fromDir,
    first.toDir,
    course.config.source,
  );
  await replaceStudentTreeFromDirectory(workspaceRoot, archives.fromDir, course.config.retain);
  await writeProgress(workspaceRoot, {
    chapter: first.id,
    completed: false,
    appliedSide: "start",
  });
}

/** Temporary or in-place course config directory used while creating a workspace. */
export interface CourseConfigSource {
  configDir: string;
  cleanup: () => Promise<void>;
}

/**
 * Resolves course config from a local `course.jsonc` path or by cloning a git course repository.
 *
 * Local inputs must be the `course.jsonc` file (or a `file:` URL to it), not a directory.
 * GitHub blob/raw URLs that point at `course.jsonc` clone the parent repository, then use that path.
 * A git URL may append `#path/to/course.jsonc` for a nested config. Other remote git URLs are cloned,
 * then `course.jsonc` is found at the clone root or under `.course-config/`.
 *
 * @param git - Git client
 * @param courseRepoUrl - User-supplied `course.jsonc` path, GitHub file URL, or git URL
 * @param onLog - Optional progress logger
 */
export async function resolveCourseConfigDir(
  git: GitClient,
  courseRepoUrl: string,
  onLog?: (line: string) => void,
): Promise<CourseConfigSource> {
  const local = localCourseOrigin(courseRepoUrl);
  if (local !== undefined) {
    const localConfig = await resolveLocalCourseJsonc(local);
    if (localConfig !== undefined) {
      onLog?.(`Using local course config… (${local})`);
      return localConfig;
    }
    if (!isRemoteGitUrl(courseRepoUrl)) {
      throw new Error(`course.jsonc not found: ${courseRepoUrl}`);
    }
  }

  const remote = parseCourseConfigUrl(courseRepoUrl);
  if (remote === undefined) {
    throw new Error(`course.jsonc not found: ${courseRepoUrl}`);
  }

  onLog?.("Cloning course repository…");
  const courseCloneDir = await mkdtemp(path.join(tmpdir(), "learn-by-diff-course-"));
  try {
    if (remote.kind === "githubFile") {
      const branch = githubCloneBranch(remote.ref);
      await git.clone(remote.cloneUrl, courseCloneDir, {
        depth: 1,
        ...(branch !== undefined ? { branch } : {}),
      });
      const configFile = joinConfigRelative(courseCloneDir, remote.configRelPath);
      const configDir = await configDirFromClonedCourseFile(configFile, remote.configRelPath);
      return {
        configDir,
        cleanup: async () => {
          await rm(courseCloneDir, { recursive: true, force: true });
        },
      };
    }

    await git.clone(remote.url, courseCloneDir);
    if (remote.configRelPath !== undefined) {
      const configFile = joinConfigRelative(courseCloneDir, remote.configRelPath);
      const configDir = await configDirFromClonedCourseFile(configFile, remote.configRelPath);
      return {
        configDir,
        cleanup: async () => {
          await rm(courseCloneDir, { recursive: true, force: true });
        },
      };
    }
    const configDir = await findCourseConfigDir(courseCloneDir);
    if (configDir === undefined) {
      throw new ProtocolError([
        {
          path: COURSE_FILE_NAME,
          message:
            "course config file was not found (looked in course.jsonc, then .course-config/course.jsonc)",
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
 * Returns the directory that contains a cloned `course.jsonc`, or throws if the file is missing.
 *
 * @param configFile - Absolute path to the expected `course.jsonc`
 * @param configRelPath - Posix-relative path shown in the error
 */
async function configDirFromClonedCourseFile(
  configFile: string,
  configRelPath: string,
): Promise<string> {
  let info: Awaited<ReturnType<typeof stat>>;
  try {
    info = await stat(configFile);
  } catch {
    throw new Error(`${COURSE_FILE_NAME} not found in cloned repository: ${configRelPath}`);
  }
  if (!info.isFile() || path.basename(configFile) !== COURSE_FILE_NAME) {
    throw new Error(`${COURSE_FILE_NAME} not found in cloned repository: ${configRelPath}`);
  }
  return path.dirname(configFile);
}

/**
 * Resolves a local filesystem path to the directory that contains `course.jsonc`.
 *
 * Directories are rejected so Open Course always takes an explicit file.
 *
 * @param local - Absolute filesystem path from {@link localCourseOrigin}
 * @returns Config source, or `undefined` when the path does not exist
 */
async function resolveLocalCourseJsonc(local: string): Promise<CourseConfigSource | undefined> {
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
 * Copies `course.jsonc` and the configured chapters directory into the learning workspace.
 *
 * Does not copy the rest of a course-home tree (source files, git metadata).
 *
 * @param fromConfigDir - Directory that contains `course.jsonc`
 * @param toConfigDir - `.learn/course` destination
 * @param chaptersDir - Posix-relative chapters directory from `course.jsonc`
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
 * @param configDir - Directory that contains `course.jsonc`
 * @param relativePosix - Slash-separated path under the config directory
 */
function joinConfigRelative(configDir: string, relativePosix: string): string {
  return path.join(configDir, ...relativePosix.split("/").filter((segment) => segment !== ""));
}

/**
 * Replaces the student tree with a chapter start (`fromDir`) or finish (`toDir`).
 *
 * Copies from `.learn/snapshots` (writing that cache first when missing) so
 * chapter switches stay local after background prefetch. Overlays the snapshot
 * in place, then deletes paths that are not in `course.config.retain` and not in
 * the snapshot. The learner `.gitignore` text is restored when the snapshot also
 * has one, then learn ignore rules are merged.
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
  const { sourceMirror } = learningPaths(workspaceRoot);
  const archives = await writeChapterArchives(
    git,
    sourceMirror,
    workspaceRoot,
    chapter.fromDir,
    chapter.toDir,
    course.config.source,
  );
  const snapshotRoot = side === "finish" ? archives.toDir : archives.fromDir;
  await replaceStudentTreeFromDirectory(workspaceRoot, snapshotRoot, course.config.retain);
  await writeProgress(workspaceRoot, {
    chapter: chapterId,
    completed: false,
    appliedSide: side,
  });
}

/**
 * Overlays a cached snapshot onto the student tree, then deletes paths outside it.
 *
 * Chapter snapshots may include a `.gitignore`; that must not replace the learner's
 * file. Learn-related ignore rules are merged afterward via {@link ensureLearnGitignore}.
 * Paths in `retain` stay even when the snapshot does not contain them.
 *
 * @param workspaceRoot - Learning workspace root
 * @param snapshotRoot - Cached `from` or `to` snapshot directory
 * @param retain - Paths that must not be deleted, including built-ins from the learning copy
 */
async function replaceStudentTreeFromDirectory(
  workspaceRoot: string,
  snapshotRoot: string,
  retain: readonly string[],
): Promise<void> {
  const preservedGitignore = await readGitignore(workspaceRoot);
  await overlayDirectoryChildren(snapshotRoot, workspaceRoot);
  await finishStudentTreeReplace(workspaceRoot, snapshotRoot, retain, preservedGitignore);
}

/**
 * Restores the learner `.gitignore`, merges learn ignore rules, and deletes extra paths.
 *
 * @param workspaceRoot - Learning workspace root
 * @param snapshotRoot - Directory whose files must remain after the overlay
 * @param retain - Paths that must not be deleted
 * @param preservedGitignore - Learner `.gitignore` text captured before the overlay, if any
 */
async function finishStudentTreeReplace(
  workspaceRoot: string,
  snapshotRoot: string,
  retain: readonly string[],
  preservedGitignore: string | undefined,
): Promise<void> {
  if (preservedGitignore !== undefined) {
    await writeFile(path.join(workspaceRoot, ".gitignore"), preservedGitignore, "utf8");
  }
  await ensureLearnGitignore(workspaceRoot);
  await prunePathsOutsideSnapshot(workspaceRoot, snapshotRoot, retain);
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
  ".learn/source-clone/",
  ".learn/snapshots/",
  ".learn/refs/",
  ".learn/origin.json",
  ".learn/chapter-config-download.json",
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
