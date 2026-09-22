import { COURSE_FILE_NAME } from "@learn-by-diff/protocol";
import { access } from "node:fs/promises";
import path from "node:path";
import type { GitClient } from "../git/client.ts";
import {
  describeCourseOrigin,
  posixRelative,
  readCourseOrigin,
  tryGitCheckoutInfo,
  type CourseOpenOrigin,
} from "./courseOrigin.ts";
import { learningPaths } from "./paths.ts";

/** Which `url=` source a copied one-click open link uses. */
export type OpenCourseLinkKind = "local" | "git" | "github";

/** One selectable course URL for a one-click open link. */
export interface OpenCourseLinkSource {
  kind: OpenCourseLinkKind;
  /** Value placed in the deep-link `url` query. */
  url: string;
}

/**
 * Collects local, git, and GitHub `url=` sources for the open learning workspace.
 *
 * Local always includes a `course.yml` path (original file when it still exists, else the
 * `.learn/course` copy). Git and GitHub are omitted when they cannot be derived.
 *
 * @param git - Git client
 * @param workspaceRoot - Learning workspace root
 */
export async function collectOpenCourseLinkSources(
  git: GitClient,
  workspaceRoot: string,
): Promise<OpenCourseLinkSource[]> {
  const paths = learningPaths(workspaceRoot);
  const learnCourseYml = path.join(paths.courseDir, COURSE_FILE_NAME);
  let origin = await readCourseOrigin(workspaceRoot);
  origin = await enrichOriginFromLocalGit(git, origin, learnCourseYml);

  const sources: OpenCourseLinkSource[] = [];
  const localUrl = await resolveLocalCourseYml(origin, learnCourseYml);
  sources.push({ kind: "local", url: localUrl });

  const gitUrl = gitOpenCourseUrl(origin);
  if (gitUrl !== undefined) {
    sources.push({ kind: "git", url: gitUrl });
  }

  const githubUrl = githubOpenCourseUrl(origin);
  if (githubUrl !== undefined) {
    sources.push({ kind: "github", url: githubUrl });
  }

  return sources;
}

/**
 * Fills missing git/GitHub fields from a local checkout when origin was a filesystem open.
 *
 * @param git - Git client
 * @param origin - Stored origin, or `undefined` for older workspaces
 * @param learnCourseYml - `.learn/course/course.yml`
 */
async function enrichOriginFromLocalGit(
  git: GitClient,
  origin: CourseOpenOrigin | undefined,
  learnCourseYml: string,
): Promise<CourseOpenOrigin | undefined> {
  if (origin === undefined) {
    return describeCourseOrigin(git, learnCourseYml, path.dirname(learnCourseYml));
  }
  if (origin.gitUrl !== undefined) {
    return origin;
  }
  const probeDir =
    origin.localCourseYml !== undefined ? path.dirname(origin.localCourseYml) : undefined;
  if (probeDir === undefined) {
    return origin;
  }
  const info = await tryGitCheckoutInfo(git, probeDir);
  if (info === undefined) {
    return origin;
  }
  return {
    ...origin,
    gitUrl: info.originUrl,
    configRelPath: await posixRelative(info.toplevel, origin.localCourseYml ?? learnCourseYml),
    ...(info.branch !== "" ? { githubRef: origin.githubRef ?? info.branch } : {}),
  };
}

/**
 * Returns the local `course.yml` path to put in `url=`.
 *
 * Prefers the original file when it still exists.
 *
 * @param origin - Stored origin
 * @param learnCourseYml - Fallback `.learn/course/course.yml`
 */
async function resolveLocalCourseYml(
  origin: CourseOpenOrigin | undefined,
  learnCourseYml: string,
): Promise<string> {
  const candidate = origin?.localCourseYml;
  if (candidate !== undefined && (await fileExists(candidate))) {
    return candidate;
  }
  return learnCourseYml;
}

/**
 * Builds a git clone URL, appending `#path/to/course.yml` when the config is nested.
 *
 * @param origin - Stored origin
 */
export function gitOpenCourseUrl(origin: CourseOpenOrigin | undefined): string | undefined {
  const gitUrl = origin?.gitUrl?.trim();
  if (gitUrl === undefined || gitUrl === "") {
    return undefined;
  }
  const rel = origin?.configRelPath?.trim();
  if (rel === undefined || rel === "") {
    return gitUrl;
  }
  if (gitUrl.includes("#")) {
    return gitUrl;
  }
  return `${gitUrl}#${rel}`;
}

/**
 * Builds a GitHub blob/raw `course.yml` URL, or returns the original GitHub file URL.
 *
 * @param origin - Stored origin
 */
export function githubOpenCourseUrl(origin: CourseOpenOrigin | undefined): string | undefined {
  const pasted = origin?.githubFileUrl?.trim();
  if (pasted !== undefined && pasted !== "") {
    return pasted;
  }
  const gitUrl = origin?.gitUrl?.trim();
  if (gitUrl === undefined || gitUrl === "") {
    return undefined;
  }
  const parts = githubOwnerRepo(gitUrl);
  if (parts === undefined) {
    return undefined;
  }
  const rel = origin?.configRelPath?.trim() || COURSE_FILE_NAME;
  const ref = origin?.githubRef?.trim() || "main";
  return `https://github.com/${parts.owner}/${parts.repo}/blob/${ref}/${rel}`;
}

/**
 * Extracts GitHub owner and repo from an https, ssh, or `git@` clone URL.
 *
 * @param gitUrl - Clone URL (fragment ignored)
 */
export function githubOwnerRepo(gitUrl: string): { owner: string; repo: string } | undefined {
  const withoutFragment = gitUrl.split("#")[0] ?? gitUrl;
  const httpsMatch = /^(?:https?:\/\/)(?:www\.)?github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i.exec(
    withoutFragment.trim(),
  );
  if (httpsMatch !== null) {
    const owner = httpsMatch[1];
    const repo = httpsMatch[2];
    if (owner !== undefined && repo !== undefined) {
      return { owner, repo };
    }
  }
  const sshMatch =
    /^(?:git@github\.com:|ssh:\/\/git@github\.com\/)([^/]+)\/([^/]+?)(?:\.git)?\/?$/i.exec(
      withoutFragment.trim(),
    );
  if (sshMatch === null) {
    return undefined;
  }
  const owner = sshMatch[1];
  const repo = sshMatch[2];
  if (owner === undefined || repo === undefined) {
    return undefined;
  }
  return { owner, repo };
}

/**
 * Returns whether `filePath` exists as a file.
 *
 * @param filePath - Absolute path
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
