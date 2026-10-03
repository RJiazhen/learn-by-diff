import { describe, expect, test } from "vite-plus/test";
import { parseCourseConfigUrl } from "../src/workspace/parseCourseConfigUrl.ts";
import {
  OFFICIAL_COURSES_CATALOG_RAW_URL,
  OfficialCourseCatalogError,
  loadOfficialCourses,
  parseOfficialCourseCatalog,
  type RemoteTextFetcher,
} from "../src/workspace/officialCourses.ts";

const catalog = `{
  // official list
  "courses": [
    { "id": "chibivue-zh-cn", "title": "Catalog title", "path": "chibivue-zh-cn" },
    { "id": "nested", "title": "Nested catalog", "path": "nested-course" },
    { "id": "missing", "title": "Missing file", "path": "missing-course" },
    { "id": "spaced", "title": "Spaced", "path": "my course" },
    { "id": "bad", "title": "Bad", "path": "../secret" },
    { "title": "From path", "path": "direct/course.jsonc" },
  ],
}
`;

/**
 * Returns catalog text for the official URL and fixture files for known course paths.
 *
 * @param files - Repo-relative path to file text; omitted paths are missing
 */
function fixtureFetcher(files: Record<string, string>): RemoteTextFetcher {
  /**
   * Serves the catalog and the fixture map.
   *
   * @param url - Requested raw or catalog URL
   */
  async function fetchText(url: string): Promise<string | undefined> {
    if (url === OFFICIAL_COURSES_CATALOG_RAW_URL) {
      return catalog;
    }
    const prefix = "https://raw.githubusercontent.com/RJiazhen/learn-by-diff-courses/main/";
    if (!url.startsWith(prefix)) {
      return undefined;
    }
    return files[decodeURIComponent(url.slice(prefix.length))];
  }
  return fetchText;
}

describe("parseOfficialCourseCatalog", () => {
  test("reads courses and skips unsafe paths", () => {
    expect(parseOfficialCourseCatalog(catalog)).toEqual([
      { id: "chibivue-zh-cn", title: "Catalog title", path: "chibivue-zh-cn" },
      { id: "nested", title: "Nested catalog", path: "nested-course" },
      { id: "missing", title: "Missing file", path: "missing-course" },
      { id: "spaced", title: "Spaced", path: "my course" },
      { id: "direct", title: "From path", path: "direct/course.jsonc" },
    ]);
  });

  test("rejects a document that is not a catalog", () => {
    expect(() => parseOfficialCourseCatalog("[]")).toThrow(OfficialCourseCatalogError);
  });
});

describe("loadOfficialCourses", () => {
  test("uses course.jsonc titles and opens that file URL", async () => {
    const courses = await loadOfficialCourses(
      fixtureFetcher({
        "chibivue-zh-cn/course.jsonc": `{ "id": "from-file", "title": "From file" }`,
        "nested-course/.course-config/course.jsonc": `{ "id": "nested-file", "title": "Nested file" }`,
        "my course/course.jsonc": `{ "title": "Spaced file" }`,
        "direct/course.jsonc": `{ "title": "Direct file" }`,
      }),
    );

    expect(courses).toEqual([
      {
        id: "from-file",
        title: "From file",
        courseJsoncUrl:
          "https://github.com/RJiazhen/learn-by-diff-courses/blob/main/chibivue-zh-cn/course.jsonc",
        courseJsoncText: `{ "id": "from-file", "title": "From file" }`,
      },
      {
        id: "nested-file",
        title: "Nested file",
        courseJsoncUrl:
          "https://github.com/RJiazhen/learn-by-diff-courses/blob/main/nested-course/.course-config/course.jsonc",
        courseJsoncText: `{ "id": "nested-file", "title": "Nested file" }`,
      },
      {
        id: "missing",
        title: "Missing file",
        courseJsoncUrl:
          "https://github.com/RJiazhen/learn-by-diff-courses/blob/main/missing-course/course.jsonc",
      },
      {
        id: "spaced",
        title: "Spaced file",
        courseJsoncUrl:
          "https://github.com/RJiazhen/learn-by-diff-courses/blob/main/my%20course/course.jsonc",
        courseJsoncText: `{ "title": "Spaced file" }`,
      },
      {
        id: "direct",
        title: "Direct file",
        courseJsoncUrl:
          "https://github.com/RJiazhen/learn-by-diff-courses/blob/main/direct/course.jsonc",
        courseJsoncText: `{ "title": "Direct file" }`,
      },
    ]);
    expect(parseCourseConfigUrl(courses[0]?.courseJsoncUrl ?? "")).toMatchObject({
      kind: "githubFile",
      configRelPath: "chibivue-zh-cn/course.jsonc",
    });
  });

  test("fails when the catalog cannot be downloaded", async () => {
    /**
     * Simulates a missing catalog.
     */
    async function missingCatalog(): Promise<undefined> {
      return undefined;
    }
    await expect(loadOfficialCourses(missingCatalog)).rejects.toBeInstanceOf(
      OfficialCourseCatalogError,
    );
  });
});
