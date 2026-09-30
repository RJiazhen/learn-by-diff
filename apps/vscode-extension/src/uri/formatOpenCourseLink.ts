/** Marketplace extension id used as the deep-link authority. */
export const OPEN_COURSE_EXTENSION_ID = "RuanJiazhen.learn-by-diff";

/** URI schemes that host LearnByDiff one-click open links. */
export const OPEN_COURSE_LINK_SCHEMES = ["vscode", "cursor"] as const;

/** Editor scheme used in a one-click open URI. */
export type OpenCourseEditorScheme = (typeof OPEN_COURSE_LINK_SCHEMES)[number];

/**
 * Builds a LearnByDiff one-click open URI for one editor scheme.
 *
 * @param scheme - `vscode` or `cursor`
 * @param courseUrl - Value for the `url` query (local `course.yml` path, git URL, or GitHub file URL)
 */
export function formatOpenCourseDeepLink(scheme: string, courseUrl: string): string {
  return `${scheme}://${OPEN_COURSE_EXTENSION_ID}/open?url=${encodeURIComponent(courseUrl)}`;
}

/**
 * Builds vscode and cursor one-click open URIs for the same course URL, one per line.
 *
 * @param courseUrl - Value for the `url` query
 */
export function formatOpenCourseDeepLinks(courseUrl: string): string {
  return OPEN_COURSE_LINK_SCHEMES.map((scheme) => formatOpenCourseDeepLink(scheme, courseUrl)).join(
    "\n",
  );
}
