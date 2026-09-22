import { COURSE_FILE_NAME } from "@learn-by-diff/protocol";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GitClient } from "../git/client.ts";
import { parseCourseConfigUrl } from "./parseCourseConfigUrl.ts";
import { learningPaths } from "./paths.ts";
import { isRemoteGitUrl, localCourseOrigin } from "./resolveRepo.ts";

/** How this learning workspace was opened; used to copy one-click open links. */
export interface CourseOpenOrigin {
  /** Original Open Course input. */
  input: string;
  /** Absolute local `course.yml` when the input was a filesystem path. */
  localCourseYml?: string;
  /** Git clone URL when the course came from a remote or a local git checkout. */
  gitUrl?: string;
  /** Posix-relative path to `course.yml` inside the git repository. */
  configRelPath?: string;
  /** GitHub ref for blob URLs (branch, tag, or SHA). */
  githubRef?: string;
  /** Original GitHub blob/raw URL when the user pasted one. */
  githubFileUrl?: string;
}

/**
 * Reads `.learn/origin.json`, or `undefined` when missing or invalid.
 *
 * @param workspaceRoot - Learning workspace root
 */
export async function readCourseOrigin(
  workspaceRoot: string,
): Promise<CourseOpenOrigin | undefined> {
  try {
    const text = await readFile(learningPaths(workspaceRoot).originFile, "utf8");
    const parsed: unknown = JSON.parse(text);
    return isCourseOpenOrigin(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Writes `.learn/origin.json`, creating `.learn` if needed.
 *
 * @param workspaceRoot - Learning workspace root
 * @param origin - Open-course origin document
 */
export async function writeCourseOrigin(
  workspaceRoot: string,
  origin: CourseOpenOrigin,
): Promise<void> {
  const { learnDir, originFile } = learningPaths(workspaceRoot);
  await mkdir(learnDir, { recursive: true });
  await writeFile(originFile, `${JSON.stringify(origin, null, 2)}\n`, "utf8");
}

/**
 * Records how `course.yml` was resolved so later Copy Open Course Link can rebuild URLs.
 *
 * Local paths also probe git remotes so git/GitHub links work after a filesystem open.
 *
 * @param git - Git client
 * @param courseRepoUrl - Original Open Course input
 * @param configDir - Directory that contains the resolved `course.yml`
 */
export async function describeCourseOrigin(
  git: GitClient,
  courseRepoUrl: string,
  configDir: string,
): Promise<CourseOpenOrigin> {
  const origin: CourseOpenOrigin = { input: courseRepoUrl.trim() };
  const local = localCourseOrigin(courseRepoUrl);
  if (local !== undefined && !isRemoteGitUrl(courseRepoUrl.trim())) {
    origin.localCourseYml = path.join(configDir, COURSE_FILE_NAME);
    await fillGitFieldsFromCheckout(git, origin, configDir, origin.localCourseYml);
    return origin;
  }

  try {
    const remote = parseCourseConfigUrl(courseRepoUrl);
    if (remote === undefined) {
      return origin;
    }
    if (remote.kind === "githubFile") {
      origin.gitUrl = remote.cloneUrl;
      origin.configRelPath = remote.configRelPath;
      origin.githubRef = remote.ref;
      origin.githubFileUrl = courseRepoUrl.trim();
      return origin;
    }
    origin.gitUrl = remote.url;
    if (remote.configRelPath !== undefined) {
      origin.configRelPath = remote.configRelPath;
    }
    return origin;
  } catch {
    return origin;
  }
}

/**
 * Adds git clone URL, in-repo `course.yml` path, and current branch when `dir` is a checkout.
 *
 * @param git - Git client
 * @param origin - Origin document to update
 * @param dir - Directory inside the checkout
 * @param courseYmlPath - Absolute `course.yml` path
 */
async function fillGitFieldsFromCheckout(
  git: GitClient,
  origin: CourseOpenOrigin,
  dir: string,
  courseYmlPath: string,
): Promise<void> {
  const info = await tryGitCheckoutInfo(git, dir);
  if (info === undefined) {
    return;
  }
  origin.gitUrl = info.originUrl;
  origin.configRelPath = await posixRelative(info.toplevel, courseYmlPath);
  if (info.branch !== "") {
    origin.githubRef = info.branch;
  }
}

/** Git checkout metadata used to rebuild shareable course URLs. */
interface GitCheckoutInfo {
  toplevel: string;
  originUrl: string;
  branch: string;
}

/**
 * Returns origin URL and branch for a git worktree, or `undefined` when git lookup fails.
 *
 * @param git - Git client
 * @param dir - Directory inside a git worktree
 */
export async function tryGitCheckoutInfo(
  git: GitClient,
  dir: string,
): Promise<GitCheckoutInfo | undefined> {
  try {
    const toplevel = (await git.run(["rev-parse", "--show-toplevel"], { cwd: dir })).stdout.trim();
    if (toplevel === "") {
      return undefined;
    }
    const originUrl = await firstGitRemoteUrl(git, toplevel);
    if (originUrl === undefined) {
      return undefined;
    }
    const branch = await currentGitBranch(git, toplevel);
    return { toplevel, originUrl, branch };
  } catch {
    return undefined;
  }
}

/**
 * Returns the current branch name, or `""` when detached / unborn / lookup fails.
 *
 * @param git - Git client
 * @param toplevel - Repository root
 */
async function currentGitBranch(git: GitClient, toplevel: string): Promise<string> {
  try {
    const name = (
      await git.run(["symbolic-ref", "--short", "HEAD"], { cwd: toplevel })
    ).stdout.trim();
    return name === "HEAD" ? "" : name;
  } catch {
    // Detached HEAD or empty repo: try abbrev-ref, otherwise leave empty.
  }
  try {
    const name = (
      await git.run(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: toplevel })
    ).stdout.trim();
    return name === "HEAD" ? "" : name;
  } catch {
    return "";
  }
}

/**
 * Returns `origin`'s URL, or the first configured remote, from a git worktree.
 *
 * @param git - Git client
 * @param toplevel - Repository root
 */
async function firstGitRemoteUrl(git: GitClient, toplevel: string): Promise<string | undefined> {
  try {
    const origin = (
      await git.run(["remote", "get-url", "origin"], { cwd: toplevel })
    ).stdout.trim();
    if (origin !== "") {
      return origin;
    }
  } catch {
    // No origin; try the first remote name.
  }
  try {
    const names = (await git.run(["remote"], { cwd: toplevel })).stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");
    const first = names[0];
    if (first === undefined) {
      return undefined;
    }
    const url = (await git.run(["remote", "get-url", first], { cwd: toplevel })).stdout.trim();
    return url === "" ? undefined : url;
  } catch {
    return undefined;
  }
}

/**
 * Returns a posix-relative path from `fromDir` to `toPath`, resolving symlinks first.
 *
 * Needed so macOS `/tmp` vs `/private/tmp` does not produce a `../..` walk to `/`.
 *
 * @param fromDir - Absolute directory
 * @param toPath - Absolute file path
 */
export async function posixRelative(fromDir: string, toPath: string): Promise<string> {
  const from = await realpath(fromDir);
  const to = await realpath(toPath);
  return path.relative(from, to).split(path.sep).join("/");
}

/**
 * Type guard for {@link CourseOpenOrigin}.
 *
 * @param value - Parsed JSON
 */
function isCourseOpenOrigin(value: unknown): value is CourseOpenOrigin {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.input !== "string") {
    return false;
  }
  if (record.localCourseYml !== undefined && typeof record.localCourseYml !== "string") {
    return false;
  }
  if (record.gitUrl !== undefined && typeof record.gitUrl !== "string") {
    return false;
  }
  if (record.configRelPath !== undefined && typeof record.configRelPath !== "string") {
    return false;
  }
  if (record.githubRef !== undefined && typeof record.githubRef !== "string") {
    return false;
  }
  if (record.githubFileUrl !== undefined && typeof record.githubFileUrl !== "string") {
    return false;
  }
  return true;
}
