import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vite-plus/test";
import {
  findCourseConfigDir,
  isCourseRepository,
  loadCourse,
  ProtocolError,
} from "../src/index.ts";

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

  test("applies course.yml defaults when fields are omitted", async () => {
    const course = await loadCourse(fixtureRoot("empty-course"));
    expect(course.config.id).toBe("empty-course");
    expect(course.config.title).toBe("empty-course");
    expect(course.config.source.repository).toBe(".");
    expect(course.chapters.map((chapter) => chapter.id)).toEqual(["hello"]);
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

  test("loads course.yml at the specified directory root", async () => {
    const course = await loadCourse(fixtureRoot("root-course"));
    expect(course.config.id).toBe("root-course");
    expect(course.config.title).toBe("Root Course");
    expect(course.configDir).toBe(fixtureRoot("root-course"));
    expect(course.chapters.map((chapter) => chapter.id)).toEqual(["intro"]);
  });

  test("prefers root course.yml over .course-config/course.yml", async () => {
    const course = await loadCourse(fixtureRoot("prefer-root-course"));
    expect(course.config.id).toBe("from-root");
    expect(course.chapters.map((chapter) => chapter.id)).toEqual(["root-chapter"]);
  });
});

describe("findCourseConfigDir", () => {
  test("returns the specified directory when course.yml is there", async () => {
    expect(await findCourseConfigDir(fixtureRoot("root-course"))).toBe(fixtureRoot("root-course"));
  });

  test("falls back to .course-config when the root has no course.yml", async () => {
    expect(await findCourseConfigDir(fixtureRoot("valid-course"))).toBe(
      path.join(fixtureRoot("valid-course"), ".course-config"),
    );
  });
});

describe("isCourseRepository", () => {
  test("detects course.yml at the root or under .course-config", async () => {
    expect(await isCourseRepository(fixtureRoot("valid-course"))).toBe(true);
    expect(await isCourseRepository(fixtureRoot("root-course"))).toBe(true);
    expect(await isCourseRepository(fixturesDir)).toBe(false);
  });
});
