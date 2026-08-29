import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { chapterIdFromFileName } from "../src/chapterDefaults.ts";
import { applyCourseDefaults, courseHomeDir, defaultCourseId } from "../src/courseDefaults.ts";
import { normalizeSourceDirPath, resolveSourceSubtreePath } from "../src/sourcePath.ts";
import { parseChapterYaml, parseCourseYaml } from "../src/parse.ts";
import { ProtocolError } from "../src/types.ts";
import { validateCourse } from "../src/validate.ts";

const validConfig = {
  id: "demo",
  title: "Demo",
  source: { repository: "https://example.com/src.git" },
};

const validChapter = {
  id: "one",
  title: "One",
  fromDir: "a",
  toDir: "b",
};

describe("chapterIdFromFileName", () => {
  test("strips numeric prefixes", () => {
    expect(chapterIdFromFileName("001-hello.yml")).toBe("hello");
    expect(chapterIdFromFileName("01_world.yaml")).toBe("world");
    expect(chapterIdFromFileName("2.bang.yml")).toBe("bang");
  });
});

describe("course defaults", () => {
  test("courseHomeDir resolves .course-config and .learn/course layouts", () => {
    expect(courseHomeDir("/repo/demo/.course-config")).toBe("/repo/demo");
    expect(courseHomeDir("/tmp/learn/.learn/course")).toBe("/tmp/learn");
  });

  test("defaultCourseId uses parent folder name when not a git root", () => {
    expect(defaultCourseId("/repo/examples/demo-course/.course-config")).toBe("demo-course");
  });

  test("defaultCourseId appends -learn when .course-config is at a git root", () => {
    const root = path.join(os.tmpdir(), `lbd-git-root-${String(process.pid)}`);
    fs.mkdirSync(path.join(root, ".git"), { recursive: true });
    fs.mkdirSync(path.join(root, ".course-config"), { recursive: true });
    try {
      expect(defaultCourseId(path.join(root, ".course-config"))).toBe(
        `${path.basename(root)}-learn`,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("applyCourseDefaults fills id, title, and repository", () => {
    const config = applyCourseDefaults(
      { id: "", title: "", source: { repository: "" } },
      "/repo/my-course/.course-config",
    );
    expect(config.id).toBe("my-course");
    expect(config.title).toBe("my-course");
    expect(config.source.repository).toBe(".");
  });
});

describe("parseCourseYaml", () => {
  test("throws on invalid YAML", () => {
    expect(() => parseCourseYaml(": :", "course.yml")).toThrow(ProtocolError);
  });

  test("throws when the document is not a mapping", () => {
    expect(() => parseCourseYaml("- just a list\n", "course.yml")).toThrow(ProtocolError);
  });

  test("accepts an empty document", () => {
    expect(parseCourseYaml("", "course.yml")).toEqual({
      id: "",
      title: "",
      source: { repository: "" },
    });
  });

  test("parses optional source.root", () => {
    const config = parseCourseYaml(
      ["source:", "  repository: https://example.com/src.git", "  root: learn/demo", ""].join("\n"),
      "course.yml",
    );
    expect(config.source.root).toBe("learn/demo");
  });
});

describe("parseChapterYaml", () => {
  test("defaults id and title from the filename", () => {
    const chapter = parseChapterYaml(
      "fromDir: start\ntoDir: hello\n",
      "chapters/001-hello.yml",
      "001-hello.yml",
    );
    expect(chapter.id).toBe("hello");
    expect(chapter.title).toBe("hello");
    expect(chapter.fromDir).toBe("start");
    expect(chapter.toDir).toBe("hello");
    expect(chapter.entryFiles).toBeUndefined();
  });

  test("allows empty fromDir and toDir", () => {
    const chapter = parseChapterYaml("{}\n", "chapters/001-concept.yml", "001-concept.yml");
    expect(chapter.id).toBe("concept");
    expect(chapter.fromDir).toBe("");
    expect(chapter.toDir).toBe("");
  });
});

describe("normalizeSourceDirPath", () => {
  test("accepts nested relative paths", () => {
    expect(normalizeSourceDirPath("tutorials/hello/start")).toBe("tutorials/hello/start");
    expect(normalizeSourceDirPath("a\\b")).toBe("a/b");
  });

  test("rejects absolute and parent traversal paths", () => {
    expect(normalizeSourceDirPath("/abs")).toBeUndefined();
    expect(normalizeSourceDirPath("C:\\abs")).toBeUndefined();
    expect(normalizeSourceDirPath("../x")).toBeUndefined();
    expect(normalizeSourceDirPath("a/../b")).toBeUndefined();
    expect(normalizeSourceDirPath("")).toBeUndefined();
  });
});

describe("resolveSourceSubtreePath", () => {
  test("joins source.root with chapter dirs", () => {
    expect(resolveSourceSubtreePath({ repository: "r", root: "learn/demo" }, "start")).toBe(
      "learn/demo/start",
    );
    expect(resolveSourceSubtreePath({ repository: "r" }, "tracks/a/start")).toBe("tracks/a/start");
  });

  test("returns undefined for empty dirs", () => {
    expect(resolveSourceSubtreePath({ repository: "r" }, "")).toBeUndefined();
    expect(resolveSourceSubtreePath({ repository: "r" }, "   ")).toBeUndefined();
  });
});

describe("validateCourse", () => {
  test("accepts a minimal valid course", () => {
    const course = validateCourse(validConfig, [validChapter], "/tmp/config");
    expect(course.chapters).toHaveLength(1);
    expect(course.configDir).toBe("/tmp/config");
  });

  test("accepts nested fromDir/toDir under different parents", () => {
    const course = validateCourse(
      { ...validConfig, source: { repository: "r", root: "courses/demo" } },
      [
        {
          ...validChapter,
          id: "hello",
          fromDir: "intro/start",
          toDir: "intro/hello",
        },
        {
          ...validChapter,
          id: "world",
          fromDir: "advanced/start",
          toDir: "advanced/world",
        },
      ],
      "/tmp/config",
    );
    expect(course.chapters.map((chapter) => chapter.fromDir)).toEqual([
      "intro/start",
      "advanced/start",
    ]);
    expect(course.config.source.root).toBe("courses/demo");
  });

  test("accepts empty snapshot dirs and omitted entryFiles", () => {
    const course = validateCourse(
      validConfig,
      [{ id: "concept", title: "concept", fromDir: "", toDir: "" }],
      "/tmp/config",
    );
    expect(course.chapters[0]?.fromDir).toBe("");
    expect(course.chapters[0]?.entryFiles).toBeUndefined();
  });

  test("rejects empty chapter lists", () => {
    expect(() => validateCourse(validConfig, [], "/tmp/config")).toThrow(ProtocolError);
  });

  test("rejects blank entry file paths when listed", () => {
    expect(() =>
      validateCourse(
        validConfig,
        [{ ...validChapter, entryFiles: ["src/a.ts", ""] }],
        "/tmp/config",
      ),
    ).toThrow(ProtocolError);
  });

  test("rejects unsafe fromDir paths", () => {
    expect(() =>
      validateCourse(validConfig, [{ ...validChapter, fromDir: "../secret" }], "/tmp/config"),
    ).toThrow(/fromDir/);
  });
});
