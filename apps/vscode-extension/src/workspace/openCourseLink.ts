import { COURSE_FILE_NAME } from "@learn-by-diff/protocol";
import { access } from "node:fs/promises";
import path from "node:path";
import type { GitClient } from "../git/client.ts";
import {
  formatOpenCourseDeepLink,
  OPEN_COURSE_LINK_SCHEMES,
  type OpenCourseEditorScheme,
} from "../uri/formatOpenCourseLink.ts";
import {
  describeCourseOrigin,
  posixRelative,
  readCourseOrigin,
  tryGitCheckoutInfo,
  type CourseOpenOrigin,
} from "./courseOrigin.ts";
import { learningPaths } from "./paths.ts";

/** Glob used with `vscode.workspace.findFiles` to locate `course.jsonc` files. */
export const COURSE_YML_FIND_INCLUDE = "**/course.jsonc";

/** Glob that skips generated and vendor trees when searching for `course.jsonc`. */
export const COURSE_YML_FIND_EXCLUDE = "**/{node_modules,.git,.learn,dist,build,coverage}/**";

/** Which `url=` source a copied one-click open link uses. */
export type OpenCourseLinkKind = "local" | "git";

/** One selectable course URL for a one-click open link. */
export interface OpenCourseLinkSource {
  kind: OpenCourseLinkKind;
  /** Value placed in the deep-link `url` query. */
  url: string;
}

/** One vscode or cursor one-click URI built from a single `url=` source. */
export interface OneClickCopyOption {
  scheme: OpenCourseEditorScheme;
  source: OpenCourseLinkSource;
  /** Full `vscode://` or `cursor://` URI. */
  uri: string;
}

/** Copy action offered after picking a workspace `course.jsonc`. */
export type WorkspaceCourseCopyPick =
  | { kind: "plain-local"; url: string }
  | { kind: "plain-remote"; url: string }
  | { kind: "one-click"; option: OneClickCopyOption };

/**
 * Collects local and git `url=` sources for the open learning workspace.
 *
 * Local always includes a `course.jsonc` path (original file when it still exists, else the
 * `.learn/course` copy). Git is omitted when it cannot be derived.
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

  const localUrl = await resolveLocalCourseYml(origin, learnCourseYml);
  return openCourseLinkSourcesFromOrigin(origin, localUrl);
}

/**
 * Collects local and git `url=` sources for a `course.jsonc` on disk.
 *
 * Used by the workspace scan command, which is not tied to a learning workspace.
 *
 * @param git - Git client
 * @param courseYmlPath - Absolute `course.jsonc` path
 */
export async function collectOpenCourseLinkSourcesForCourseYml(
  git: GitClient,
  courseYmlPath: string,
): Promise<OpenCourseLinkSource[]> {
  const origin = await describeCourseOrigin(git, courseYmlPath, path.dirname(courseYmlPath));
  return openCourseLinkSourcesFromOrigin(origin, courseYmlPath);
}

/**
 * Returns the original Open Course input for a learning workspace.
 *
 * Falls back to the local `course.jsonc` path when `.learn/origin.json` is missing.
 *
 * @param git - Git client
 * @param workspaceRoot - Learning workspace root
 */
export async function currentCourseOpenUrl(
  git: GitClient,
  workspaceRoot: string,
): Promise<string | undefined> {
  const origin = await readCourseOrigin(workspaceRoot);
  const input = origin?.input?.trim();
  if (input !== undefined && input !== "") {
    return input;
  }
  const sources = await collectOpenCourseLinkSources(git, workspaceRoot);
  return sources.find((source) => source.kind === "local")?.url;
}

/**
 * Builds vscode and cursor one-click URIs for each `url=` source, one option per pair.
 *
 * Order is git then local within each scheme. Callers copy a single option; this never
 * joins schemes into one clipboard string.
 *
 * @param sources - Local and/or git `url=` values
 */
export function oneClickCopyOptions(sources: OpenCourseLinkSource[]): OneClickCopyOption[] {
  const options: OneClickCopyOption[] = [];
  for (const scheme of OPEN_COURSE_LINK_SCHEMES) {
    for (const source of sourcesInCopyOrder(sources)) {
      options.push({
        scheme,
        source,
        uri: formatOpenCourseDeepLink(scheme, source.url),
      });
    }
  }
  return options;
}

/**
 * Returns workspace copy rows: plain remote/local URLs, then one-click URIs per source.
 *
 * Remote and one-click-with-git rows are omitted when the file has no git remote URL.
 *
 * @param sources - `url=` sources derived from the chosen `course.jsonc`
 */
export function workspaceCourseCopyPicks(
  sources: OpenCourseLinkSource[],
): WorkspaceCourseCopyPick[] {
  const picks: WorkspaceCourseCopyPick[] = [];
  for (const source of sourcesInCopyOrder(sources)) {
    if (source.kind === "git") {
      picks.push({ kind: "plain-remote", url: source.url });
    } else {
      picks.push({ kind: "plain-local", url: source.url });
    }
  }
  for (const option of oneClickCopyOptions(sources)) {
    picks.push({ kind: "one-click", option });
  }
  return picks;
}

/**
 * Returns sources in copy-picker order: remote git URL first, then local `course.jsonc`.
 *
 * @param sources - Local and/or git `url=` values
 */
function sourcesInCopyOrder(sources: OpenCourseLinkSource[]): OpenCourseLinkSource[] {
  const ordered: OpenCourseLinkSource[] = [];
  for (const kind of ["git", "local"] as const) {
    const source = sources.find((item) => item.kind === kind);
    if (source !== undefined) {
      ordered.push(source);
    }
  }
  return ordered;
}

/**
 * Returns whether `filePath` is a `course.jsonc` outside generated trees.
 *
 * @param filePath - Absolute or relative path
 */
export function isWorkspaceCourseYml(filePath: string): boolean {
  if (path.basename(filePath) !== COURSE_FILE_NAME) {
    return false;
  }
  const parts = filePath.split(/[/\\]/);
  return !parts.includes(".learn") && !parts.includes("node_modules");
}

/**
 * Builds local and git `url=` sources from an origin document.
 *
 * @param origin - Stored or freshly described origin
 * @param localUrl - Absolute `course.jsonc` path for the local source
 */
function openCourseLinkSourcesFromOrigin(
  origin: CourseOpenOrigin | undefined,
  localUrl: string,
): OpenCourseLinkSource[] {
  const sources: OpenCourseLinkSource[] = [{ kind: "local", url: localUrl }];
  const gitUrl = gitOpenCourseUrl(origin);
  if (gitUrl !== undefined) {
    sources.push({ kind: "git", url: gitUrl });
  }
  return sources;
}

/**
 * Fills missing git/GitHub fields from a local checkout when origin was a filesystem open.
 *
 * @param git - Git client
 * @param origin - Stored origin, or `undefined` for older workspaces
 * @param learnCourseYml - `.learn/course/course.jsonc`
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
 * Returns the local `course.jsonc` path to put in `url=`.
 *
 * Prefers the original file when it still exists.
 *
 * @param origin - Stored origin
 * @param learnCourseYml - Fallback `.learn/course/course.jsonc`
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
 * Builds a git clone URL, appending `#path/to/course.jsonc` when the config is nested.
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
