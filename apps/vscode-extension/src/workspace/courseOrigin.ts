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
  /** Absolute local `course.jsonc` when the input was a filesystem path. */
  localCourseJsonc?: string;
  /** Git clone URL when the course came from a remote or a local git checkout. */
  gitUrl?: string;
  /** Posix-relative path to `course.jsonc` inside the git repository. */
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
    return courseOpenOriginFromJson(parsed);
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
 * Records how `course.jsonc` was resolved so later copy-URL commands can rebuild shareable links.
 *
 * Local paths also probe git remotes so git/GitHub links work after a filesystem open.
 *
 * @param git - Git client
 * @param courseRepoUrl - Original Open Course input
 * @param configDir - Directory that contains the resolved `course.jsonc`
 */
export async function describeCourseOrigin(
  git: GitClient,
  courseRepoUrl: string,
  configDir: string,
): Promise<CourseOpenOrigin> {
  const origin: CourseOpenOrigin = { input: courseRepoUrl.trim() };
  const local = localCourseOrigin(courseRepoUrl);
  if (local !== undefined && !isRemoteGitUrl(courseRepoUrl.trim())) {
    origin.localCourseJsonc = path.join(configDir, COURSE_FILE_NAME);
    await fillGitFieldsFromCheckout(git, origin, configDir, origin.localCourseJsonc);
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
 * Adds git clone URL, in-repo `course.jsonc` path, and current branch when `dir` is a checkout.
 *
 * @param git - Git client
 * @param origin - Origin document to update
 * @param dir - Directory inside the checkout
 * @param courseJsoncPath - Absolute `course.jsonc` path
 */
async function fillGitFieldsFromCheckout(
  git: GitClient,
  origin: CourseOpenOrigin,
  dir: string,
  courseJsoncPath: string,
): Promise<void> {
  const info = await tryGitCheckoutInfo(git, dir);
  if (info === undefined) {
    return;
  }
  origin.gitUrl = info.originUrl;
  origin.configRelPath = await posixRelative(info.toplevel, courseJsoncPath);
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
 * Parses an origin document.
 *
 * Older files stored the local path as `localCourseYml`; that value is copied onto
 * `localCourseJsonc` when the current field is absent.
 *
 * @param value - Parsed JSON
 */
function courseOpenOriginFromJson(value: unknown): CourseOpenOrigin | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.input !== "string") {
    return undefined;
  }
  const localCourseJsonc =
    stringField(record.localCourseJsonc) ?? stringField(record.localCourseYml);
  if (!optionalString(record.localCourseJsonc) || !optionalString(record.localCourseYml)) {
    return undefined;
  }
  if (
    !optionalString(record.gitUrl) ||
    !optionalString(record.configRelPath) ||
    !optionalString(record.githubRef) ||
    !optionalString(record.githubFileUrl)
  ) {
    return undefined;
  }
  const origin: CourseOpenOrigin = { input: record.input };
  if (localCourseJsonc !== undefined) {
    origin.localCourseJsonc = localCourseJsonc;
  }
  const gitUrl = stringField(record.gitUrl);
  if (gitUrl !== undefined) {
    origin.gitUrl = gitUrl;
  }
  const configRelPath = stringField(record.configRelPath);
  if (configRelPath !== undefined) {
    origin.configRelPath = configRelPath;
  }
  const githubRef = stringField(record.githubRef);
  if (githubRef !== undefined) {
    origin.githubRef = githubRef;
  }
  const githubFileUrl = stringField(record.githubFileUrl);
  if (githubFileUrl !== undefined) {
    origin.githubFileUrl = githubFileUrl;
  }
  return origin;
}

/**
 * Returns whether `value` is absent or a string.
 *
 * @param value - JSON field
 */
function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

/**
 * Returns `value` when it is a string.
 *
 * @param value - JSON field
 */
function stringField(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
