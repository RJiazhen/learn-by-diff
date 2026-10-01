import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { chapterIdFromFileName } from "../src/chapterDefaults.ts";
import { applyCourseDefaults, courseHomeDir, defaultCourseId } from "../src/courseDefaults.ts";
import { parseChapterJsonc, parseCourseJsonc } from "../src/parse.ts";
import {
  isHttpUrl,
  normalizeRelativeFilePath,
  normalizeSourceDirPath,
  resolveSourceSubtreePath,
} from "../src/sourcePath.ts";
import { ProtocolError, type ChapterChangeKind } from "../src/types.ts";
import { validateCourse } from "../src/validate.ts";

const validConfig = {
  id: "demo",
  title: "Demo",
  source: { repository: "https://example.com/src.git" },
  chaptersDir: "chapters",
  retain: ["node_modules"],
};

const validChapter = {
  id: "one",
  title: "One",
  fromDir: "a",
  toDir: "b",
};

describe("chapterIdFromFileName", () => {
  test("strips numeric prefixes", () => {
    expect(chapterIdFromFileName("001-hello.jsonc")).toBe("hello");
    expect(chapterIdFromFileName("01_world.jsonc")).toBe("world");
    expect(chapterIdFromFileName("2.bang.jsonc")).toBe("bang");
  });
});

describe("course defaults", () => {
  test("courseHomeDir resolves .course-config, .learn/course, and root-level layouts", () => {
    expect(courseHomeDir("/repo/demo/.course-config")).toBe("/repo/demo");
    expect(courseHomeDir("/tmp/learn/.learn/course")).toBe("/tmp/learn");
    expect(courseHomeDir("/repo/demo")).toBe("/repo/demo");
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

  test("defaultCourseId appends -learn when course.jsonc is at a git root", () => {
    const root = path.join(os.tmpdir(), `lbd-git-root-${String(process.pid)}`);
    fs.mkdirSync(path.join(root, ".git"), { recursive: true });
    try {
      expect(defaultCourseId(root)).toBe(`${path.basename(root)}-learn`);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("applyCourseDefaults fills id, title, repository, and chaptersDir", () => {
    const config = applyCourseDefaults(
      { id: "", title: "", source: { repository: "" }, chaptersDir: "" },
      "/repo/my-course/.course-config",
    );
    expect(config.id).toBe("my-course");
    expect(config.title).toBe("my-course");
    expect(config.source.repository).toBe(".");
    expect(config.chaptersDir).toBe("chapters");
    expect(config.retain).toEqual(["node_modules"]);
  });

  test("applyCourseDefaults keeps an explicit retain list and an explicit empty list", () => {
    const kept = applyCourseDefaults(
      {
        id: "demo",
        title: "Demo",
        source: { repository: "." },
        chaptersDir: "chapters",
        retain: ["target", "node_modules/"],
      },
      "/repo/demo/.course-config",
    );
    expect(kept.retain).toEqual(["target", "node_modules/"]);
    const empty = applyCourseDefaults(
      {
        id: "demo",
        title: "Demo",
        source: { repository: "." },
        chaptersDir: "chapters",
        retain: [],
      },
      "/repo/demo/.course-config",
    );
    expect(empty.retain).toEqual([]);
  });
});

describe("parseCourseJsonc", () => {
  test("throws on invalid JSONC", () => {
    expect(() => parseCourseJsonc("{", "course.jsonc")).toThrow(ProtocolError);
  });

  test("throws when the document is not an object", () => {
    expect(() => parseCourseJsonc("[]\n", "course.jsonc")).toThrow(ProtocolError);
  });

  test("accepts an empty document", () => {
    expect(parseCourseJsonc("", "course.jsonc")).toEqual({
      id: "",
      title: "",
      source: { repository: "" },
      chaptersDir: "",
    });
  });

  test("parses comments and a trailing comma", () => {
    const config = parseCourseJsonc('{ /* dir */ "chaptersDir": "lessons", }\n', "course.jsonc");
    expect(config.chaptersDir).toBe("lessons");
  });

  test("parses retain and keeps an explicit empty list", () => {
    expect(parseCourseJsonc('{ "retain": ["target"] }\n', "course.jsonc").retain).toEqual([
      "target",
    ]);
    expect(parseCourseJsonc('{ "retain": [] }\n', "course.jsonc").retain).toEqual([]);
    expect(parseCourseJsonc("{}\n", "course.jsonc").retain).toBeUndefined();
  });

  test("parses optional source.root", () => {
    const config = parseCourseJsonc(
      JSON.stringify({
        source: { repository: "https://example.com/src.git", root: "learn/demo" },
      }),
      "course.jsonc",
    );
    expect(config.source.root).toBe("learn/demo");
  });
});

describe("parseChapterJsonc", () => {
  test("defaults id and title from the filename", () => {
    const chapter = parseChapterJsonc(
      '{ "fromDir": "start", "toDir": "hello" }\n',
      "chapters/001-hello.jsonc",
      "001-hello.jsonc",
    );
    expect(chapter.id).toBe("hello");
    expect(chapter.title).toBe("hello");
    expect(chapter.fromDir).toBe("start");
    expect(chapter.toDir).toBe("hello");
    expect(chapter.entryFiles).toBeUndefined();
  });

  test("parses optional docs", () => {
    const chapter = parseChapterJsonc(
      '{ "docs": "https://example.com/lesson" }\n',
      "chapters/001-hello.jsonc",
      "001-hello.jsonc",
    );
    expect(chapter.docs).toBe("https://example.com/lesson");
  });

  test("parses optional changedFiles including an empty list", () => {
    const withFiles = parseChapterJsonc(
      '{ "changedFiles": [{ "path": "src/a.ts", "kind": "M" }] }\n',
      "chapters/001-hello.jsonc",
      "001-hello.jsonc",
    );
    expect(withFiles.changedFiles).toEqual([{ path: "src/a.ts", kind: "M" }]);
    const empty = parseChapterJsonc(
      '{ "changedFiles": [] }\n',
      "chapters/001-hello.jsonc",
      "001-hello.jsonc",
    );
    expect(empty.changedFiles).toEqual([]);
  });

  test("allows empty fromDir and toDir", () => {
    const chapter = parseChapterJsonc("{}\n", "chapters/001-concept.jsonc", "001-concept.jsonc");
    expect(chapter.id).toBe("concept");
    expect(chapter.fromDir).toBe("");
    expect(chapter.toDir).toBe("");
  });
});

describe("isHttpUrl", () => {
  test("detects http(s) URLs", () => {
    expect(isHttpUrl("https://example.com/a")).toBe(true);
    expect(isHttpUrl("http://localhost:3000")).toBe(true);
    expect(isHttpUrl("README.md")).toBe(false);
    expect(isHttpUrl("ftp://x")).toBe(false);
  });
});

describe("normalizeRelativeFilePath", () => {
  test("accepts nested file paths", () => {
    expect(normalizeRelativeFilePath("notes/guide.pdf")).toBe("notes/guide.pdf");
  });

  test("rejects traversal", () => {
    expect(normalizeRelativeFilePath("../secret.md")).toBeUndefined();
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

  test("accepts author-declared changedFiles including an empty list", () => {
    const withFiles = validateCourse(
      validConfig,
      [
        {
          ...validChapter,
          changedFiles: [
            { path: "src/a.ts", kind: "M" },
            { path: "src/b.ts", kind: "U" },
            { path: "src/c.ts", kind: "D" },
          ],
        },
      ],
      "/tmp/config",
    );
    expect(withFiles.chapters[0]?.changedFiles).toHaveLength(3);
    const empty = validateCourse(
      validConfig,
      [{ ...validChapter, changedFiles: [] }],
      "/tmp/config",
    );
    expect(empty.chapters[0]?.changedFiles).toEqual([]);
  });

  test("rejects empty chapter lists", () => {
    expect(() => validateCourse(validConfig, [], "/tmp/config")).toThrow(ProtocolError);
  });

  test("rejects invalid changedFiles rows", () => {
    expect(() =>
      validateCourse(
        validConfig,
        [{ ...validChapter, changedFiles: [{ path: "", kind: "M" }] }],
        "/tmp/config",
      ),
    ).toThrow(/changedFiles/);
    expect(() =>
      validateCourse(
        validConfig,
        [{ ...validChapter, changedFiles: [{ path: "../secret.ts", kind: "M" }] }],
        "/tmp/config",
      ),
    ).toThrow(/changedFiles/);
    expect(() =>
      validateCourse(
        validConfig,
        [
          {
            ...validChapter,
            changedFiles: [{ path: "src/a.ts", kind: "X" as ChapterChangeKind }],
          },
        ],
        "/tmp/config",
      ),
    ).toThrow(/kind/);
    expect(() =>
      validateCourse(
        validConfig,
        [
          {
            ...validChapter,
            changedFiles: [
              { path: "src/a.ts", kind: "M" },
              { path: "src/a.ts", kind: "U" },
            ],
          },
        ],
        "/tmp/config",
      ),
    ).toThrow(/duplicate/);
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

  test("rejects unsafe docs paths", () => {
    expect(() =>
      validateCourse(validConfig, [{ ...validChapter, docs: "../secret.md" }], "/tmp/config"),
    ).toThrow(/docs/);
  });

  test("accepts http docs URLs", () => {
    const course = validateCourse(
      validConfig,
      [{ ...validChapter, docs: "https://example.com/docs" }],
      "/tmp/config",
    );
    expect(course.chapters[0]?.docs).toBe("https://example.com/docs");
  });

  test("rejects unsafe fromDir paths", () => {
    expect(() =>
      validateCourse(validConfig, [{ ...validChapter, fromDir: "../secret" }], "/tmp/config"),
    ).toThrow(/fromDir/);
  });

  test("rejects unsafe and duplicate retain patterns", () => {
    expect(() =>
      validateCourse({ ...validConfig, retain: ["../secret"] }, [validChapter], "/tmp/config"),
    ).toThrow(/retain/);
    expect(() =>
      validateCourse({ ...validConfig, retain: ["C:\\Windows"] }, [validChapter], "/tmp/config"),
    ).toThrow(/retain/);
    expect(() =>
      validateCourse(
        { ...validConfig, retain: ["target", "target"] },
        [validChapter],
        "/tmp/config",
      ),
    ).toThrow(/duplicate retain pattern/);
  });

  test("accepts gitignore-style retain patterns and an explicit empty list", () => {
    expect(() =>
      validateCourse(
        {
          ...validConfig,
          retain: ["*.code-workspace", "/dist", "node_modules/", "!node_modules/.bin", ".git"],
        },
        [validChapter],
        "/tmp/config",
      ),
    ).not.toThrow();
    expect(() =>
      validateCourse({ ...validConfig, retain: [] }, [validChapter], "/tmp/config"),
    ).not.toThrow();
  });

  test("rejects unsafe chaptersDir paths", () => {
    expect(() =>
      validateCourse({ ...validConfig, chaptersDir: "../secret" }, [validChapter], "/tmp/config"),
    ).toThrow(/chaptersDir/);
  });
});
