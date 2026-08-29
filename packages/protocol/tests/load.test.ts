import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vite-plus/test";
import { isCourseRepository, loadCourse, ProtocolError } from "../src/index.ts";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

/**
 * Returns an absolute fixture repository root.
 */
function fixtureRoot(name: string): string {
  return path.join(fixturesDir, name);
}

describe("loadCourse", () => {
  test("loads a valid course in chapter file-name order", async () => {
    const course = await loadCourse(fixtureRoot("valid-course"));
    expect(course.config.id).toBe("chibivue");
    expect(course.config.title).toBe("ChibiVue");
    expect(course.config.source.repository).toBe("https://github.com/chibivue-land/chibivue");
    expect(course.chapters.map((chapter) => chapter.id)).toEqual(["reactive", "effect"]);
  });

  test("rejects missing required fields", async () => {
    await expect(loadCourse(fixtureRoot("missing-fields"))).rejects.toBeInstanceOf(ProtocolError);
  });

  test("rejects unsupported protocol versions", async () => {
    try {
      await loadCourse(fixtureRoot("unsupported-version"));
      throw new Error("expected ProtocolError");
    } catch (error) {
      expect(error).toBeInstanceOf(ProtocolError);
      expect((error as ProtocolError).message).toMatch(/protocolVersion/);
    }
  });

  test("rejects duplicate chapter ids", async () => {
    try {
      await loadCourse(fixtureRoot("duplicate-ids"));
      throw new Error("expected ProtocolError");
    } catch (error) {
      expect(error).toBeInstanceOf(ProtocolError);
      expect((error as ProtocolError).message).toMatch(/duplicate chapter id/);
    }
  });

  test("rejects a repository without course.yml", async () => {
    await expect(loadCourse(fixtureRoot("valid-course/.."))).rejects.toBeInstanceOf(ProtocolError);
  });
});

describe("isCourseRepository", () => {
  test("detects .course-config/course.yml", async () => {
    expect(await isCourseRepository(fixtureRoot("valid-course"))).toBe(true);
    expect(await isCourseRepository(fixturesDir)).toBe(false);
  });
});
