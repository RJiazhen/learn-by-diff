/**
 * Parses a LearnByDiff deep-link URI into an open-course request.
 *
 * Supported shapes:
 * - `…://rjiazhen.learn-by-diff/open?url=<encoded-course-repo>`
 * - optional `parent=<absolute-or-file-uri>` for the learning workspace parent folder
 *
 * @param uri - Incoming URI from {@link vscode.window.registerUriHandler}
 * @returns Parsed request, or an error message when the URI is not usable
 */
export function parseOpenCourseUri(uri: {
  path: string;
  query: string;
}): { ok: true; courseRepoUrl: string; parentDir?: string } | { ok: false; message: string } {
  const path = uri.path.replace(/\/+$/, "") || "/";
  if (path !== "/open" && path !== "open") {
    return {
      ok: false,
      message: `Unknown LearnByDiff link path “${uri.path || "/"}”. Use /open?url=<course-repo>.`,
    };
  }

  const params = new URLSearchParams(uri.query);
  const courseRepoUrl = (params.get("url") ?? "").trim();
  if (courseRepoUrl === "") {
    return {
      ok: false,
      message: "LearnByDiff open link is missing a url query parameter.",
    };
  }

  const parentRaw = (params.get("parent") ?? "").trim();
  if (parentRaw === "") {
    return { ok: true, courseRepoUrl };
  }

  const parentDir = parentRaw.startsWith("file:") ? fileUrlToPath(parentRaw) : parentRaw;
  if (parentDir === undefined || parentDir === "") {
    return {
      ok: false,
      message: `Invalid parent folder in LearnByDiff link: ${parentRaw}`,
    };
  }
  return { ok: true, courseRepoUrl, parentDir };
}

/**
 * Converts a `file:` URL to a filesystem path (Node-compatible, no vscode dependency).
 *
 * @param fileUrl - Absolute file URL
 */
function fileUrlToPath(fileUrl: string): string | undefined {
  try {
    const parsed = new URL(fileUrl);
    if (parsed.protocol !== "file:") {
      return undefined;
    }
    // URL.pathname is percent-decoded; on Windows keep drive letter form.
    let pathname = decodeURIComponent(parsed.pathname);
    if (/^\/[A-Za-z]:\//.test(pathname)) {
      pathname = pathname.slice(1);
    }
    return pathname;
  } catch {
    return undefined;
  }
}
