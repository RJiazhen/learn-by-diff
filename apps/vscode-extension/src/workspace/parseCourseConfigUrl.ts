import { COURSE_FILE_NAME } from "@learn-by-diff/protocol";
import { isRemoteGitUrl } from "./resolveRepo.ts";

/** GitHub blob/raw `course.yml` URL, cloned as a git repository then opened at `configRelPath`. */
export interface GitHubCourseFileOrigin {
  kind: "githubFile";
  /** `https://github.com/{owner}/{repo}.git` */
  cloneUrl: string;
  /** Branch, tag, or `refs/heads|tags/...` from the URL. */
  ref: string;
  /** Posix-relative path to `course.yml` inside the clone. */
  configRelPath: string;
}

/** Remote git repository URL, optionally with a `#…/course.yml` path inside the clone. */
export interface GitRepoOrigin {
  kind: "gitRepo";
  /** Clone URL with the `#` fragment removed. */
  url: string;
  /** Posix-relative path to `course.yml` when the input used `gitUrl#path`. */
  configRelPath?: string;
}

/** Remote Open Course input after GitHub file URLs are distinguished from clone URLs. */
export type RemoteCourseOrigin = GitHubCourseFileOrigin | GitRepoOrigin;

/**
 * Classifies a user-supplied Open Course string as a GitHub `course.yml` file URL or a git repo URL.
 *
 * Local filesystem paths return `undefined` (handled separately). GitHub blob/raw URLs that are
 * not `course.yml` throw so they are never passed to `git clone`. A git clone URL may append
 * `#path/to/course.yml` to open a nested config file.
 *
 * @param input - User-supplied path or URL
 * @returns Remote origin, or `undefined` when the input is not a remote URL
 */
export function parseCourseConfigUrl(input: string): RemoteCourseOrigin | undefined {
  const trimmed = input.trim();
  if (trimmed === "") {
    return undefined;
  }

  const githubFile = tryParseGitHubFileUrl(trimmed);
  if (githubFile !== undefined) {
    return githubFile;
  }

  const hashed = tryParseGitRepoWithConfigPath(trimmed);
  if (hashed !== undefined) {
    return hashed;
  }

  if (isRemoteGitUrl(trimmed)) {
    return { kind: "gitRepo", url: trimmed };
  }

  return undefined;
}

/**
 * Returns a `git clone --branch` value when `ref` is a branch or tag, not a commit SHA.
 *
 * @param ref - Ref parsed from a GitHub file URL
 */
export function githubCloneBranch(ref: string): string | undefined {
  if (/^[0-9a-f]{7,40}$/i.test(ref)) {
    return undefined;
  }
  if (ref.startsWith("refs/heads/")) {
    const name = ref.slice("refs/heads/".length);
    return name === "" ? undefined : name;
  }
  if (ref.startsWith("refs/tags/")) {
    const name = ref.slice("refs/tags/".length);
    return name === "" ? undefined : name;
  }
  return ref;
}

/**
 * Parses a GitHub blob or raw URL that points at a file in a repository.
 *
 * @param input - Original user string (used in error messages)
 * @returns File origin when the URL is a GitHub file link to `course.yml`
 * @throws When the URL is a GitHub file link but not `course.yml`
 */
function tryParseGitHubFileUrl(input: string): GitHubCourseFileOrigin | undefined {
  const normalized = stripUrlNoise(input);
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return undefined;
  }

  const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
  let owner: string;
  let repo: string;
  let restSegments: string[];

  if (host === "raw.githubusercontent.com") {
    const segments = splitPath(parsed.pathname);
    if (segments.length < 4) {
      throw githubFileMustBeCourseYml(input);
    }
    owner = segments[0] ?? "";
    repo = segments[1] ?? "";
    restSegments = segments.slice(2);
  } else if (host === "github.com") {
    const segments = splitPath(parsed.pathname);
    if (segments.length < 3) {
      return undefined;
    }
    const kind = segments[2]?.toLowerCase();
    if (kind !== "blob" && kind !== "raw") {
      return undefined;
    }
    if (segments.length < 5) {
      throw githubFileMustBeCourseYml(input);
    }
    owner = segments[0] ?? "";
    repo = segments[1] ?? "";
    restSegments = segments.slice(3);
  } else {
    return undefined;
  }

  const split = splitRefAndPath(restSegments);
  if (split === undefined || owner === "" || repo === "") {
    throw githubFileMustBeCourseYml(input);
  }
  if (!isCourseYmlRelPath(split.filePath)) {
    throw githubFileMustBeCourseYml(input);
  }

  return {
    kind: "githubFile",
    cloneUrl: `https://github.com/${owner}/${stripGitSuffix(repo)}.git`,
    ref: split.ref,
    configRelPath: split.filePath,
  };
}

/**
 * Parses `gitUrl#relative/course.yml` into a clone URL plus in-repo config path.
 *
 * GitHub blob/raw file links are handled first, so `#L1` on those URLs is not treated as a path.
 * A non-empty fragment that is not `course.yml` throws.
 *
 * @param input - User-supplied remote string
 */
function tryParseGitRepoWithConfigPath(input: string): GitRepoOrigin | undefined {
  const hash = input.indexOf("#");
  if (hash === -1) {
    return undefined;
  }

  const cloneUrl = stripQueryAndSlash(input.slice(0, hash));
  if (!isRemoteGitUrl(cloneUrl)) {
    return undefined;
  }

  let fragment: string;
  try {
    fragment = decodeURIComponent(input.slice(hash + 1));
  } catch {
    throw gitFragmentMustBeCourseYml(input);
  }
  fragment = fragment.replace(/^\/+/, "").replace(/\/+$/, "");
  if (fragment === "") {
    return { kind: "gitRepo", url: cloneUrl };
  }
  if (!isCourseYmlRelPath(fragment)) {
    throw gitFragmentMustBeCourseYml(input);
  }
  return { kind: "gitRepo", url: cloneUrl, configRelPath: fragment };
}

/**
 * Returns whether `filePath` is a posix-relative `course.yml` with no `..` segments.
 *
 * @param filePath - Slash-separated path
 */
function isCourseYmlRelPath(filePath: string): boolean {
  return (
    !pathHasDotDot(filePath) &&
    (filePath === COURSE_FILE_NAME || filePath.endsWith(`/${COURSE_FILE_NAME}`))
  );
}

/**
 * Strips query, hash, and trailing slashes from a URL string.
 *
 * @param input - Raw user URL
 */
function stripUrlNoise(input: string): string {
  let value = input.trim();
  const hash = value.indexOf("#");
  if (hash !== -1) {
    value = value.slice(0, hash);
  }
  return stripQueryAndSlash(value);
}

/**
 * Strips a query string and trailing slashes from a URL or clone-URL prefix.
 *
 * @param value - String that may include `?query`
 */
function stripQueryAndSlash(value: string): string {
  const query = value.indexOf("?");
  const withoutQuery = query === -1 ? value.trim() : value.slice(0, query).trim();
  return withoutQuery.replace(/\/+$/, "");
}

/**
 * Splits a URL pathname into decoded non-empty segments.
 *
 * @param pathname - `URL.pathname`
 */
function splitPath(pathname: string): string[] {
  return pathname
    .split("/")
    .filter((segment) => segment !== "")
    .map((segment) => decodeURIComponent(segment));
}

/**
 * Splits `{ref}/{path}` after owner/repo, treating `refs/heads` and `refs/tags` as a three-segment ref.
 *
 * @param segments - Path segments after the GitHub file-kind prefix
 */
function splitRefAndPath(segments: string[]): { ref: string; filePath: string } | undefined {
  if (segments.length < 2) {
    return undefined;
  }
  if (
    segments.length >= 4 &&
    segments[0] === "refs" &&
    (segments[1] === "heads" || segments[1] === "tags")
  ) {
    return {
      ref: segments.slice(0, 3).join("/"),
      filePath: segments.slice(3).join("/"),
    };
  }
  return {
    ref: segments[0] ?? "",
    filePath: segments.slice(1).join("/"),
  };
}

/**
 * Returns whether a posix-relative path contains a `..` segment.
 *
 * @param filePath - Slash-separated path
 */
function pathHasDotDot(filePath: string): boolean {
  return filePath.split("/").includes("..");
}

/**
 * Strips a trailing `.git` from a GitHub repo name.
 *
 * @param repo - Repo path segment
 */
function stripGitSuffix(repo: string): string {
  return repo.replace(/\.git$/i, "");
}

/**
 * Builds the error for a GitHub file URL that does not point at `course.yml`.
 *
 * @param input - Original user string
 */
function githubFileMustBeCourseYml(input: string): Error {
  return new Error(`GitHub file URL must point at ${COURSE_FILE_NAME}: ${input}`);
}

/**
 * Builds the error for a git URL whose `#` fragment is not a `course.yml` path.
 *
 * @param input - Original user string
 */
function gitFragmentMustBeCourseYml(input: string): Error {
  return new Error(`git URL # fragment must be a ${COURSE_FILE_NAME} path: ${input}`);
}
