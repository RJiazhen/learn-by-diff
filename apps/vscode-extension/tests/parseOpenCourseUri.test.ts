import { describe, expect, test } from "vite-plus/test";
import { parseOpenCourseUri } from "../src/uri/parseOpenCourseUri.ts";

describe("parseOpenCourseUri", () => {
  test("parses /open?url=", () => {
    const result = parseOpenCourseUri({
      path: "/open",
      query: "url=https%3A%2F%2Fgithub.com%2Forg%2Fcourse.git",
    });
    expect(result).toEqual({
      ok: true,
      courseRepoUrl: "https://github.com/org/course.git",
    });
  });

  test("accepts optional parent path", () => {
    const result = parseOpenCourseUri({
      path: "/open",
      query: "url=https://example.com/c.git&parent=%2Ftmp%2Flearn",
    });
    expect(result).toEqual({
      ok: true,
      courseRepoUrl: "https://example.com/c.git",
      parentDir: "/tmp/learn",
    });
  });

  test("rejects missing url", () => {
    const result = parseOpenCourseUri({ path: "/open", query: "" });
    expect(result).toEqual({ ok: false, error: { kind: "missingUrl" } });
  });

  test("rejects unknown paths", () => {
    const result = parseOpenCourseUri({ path: "/clone", query: "url=x" });
    expect(result).toEqual({
      ok: false,
      error: { kind: "unknownPath", path: "/clone" },
    });
  });

  test("rejects invalid file parent", () => {
    const result = parseOpenCourseUri({
      path: "/open",
      query: "url=https://example.com/c.git&parent=file://[",
    });
    expect(result).toEqual({
      ok: false,
      error: { kind: "invalidParent", parentRaw: "file://[" },
    });
  });
});
