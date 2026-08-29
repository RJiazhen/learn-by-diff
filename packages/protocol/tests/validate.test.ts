import { describe, expect, test } from "vite-plus/test";
import { parseCourseYaml } from "../src/parse.ts";
import { ProtocolError, PROTOCOL_VERSION } from "../src/types.ts";
import { validateCourse } from "../src/validate.ts";

const validConfig = {
  protocolVersion: PROTOCOL_VERSION,
  id: "demo",
  title: "Demo",
  source: { repository: "https://example.com/src.git" },
  workspace: { install: "pnpm i", dev: "pnpm dev", test: "pnpm test" },
};

const validChapter = {
  id: "one",
  title: "One",
  fromDir: "a",
  toDir: "b",
  entryFiles: ["src/a.ts"],
  tests: ["src/a.test.ts"],
};

describe("parseCourseYaml", () => {
  test("throws on invalid YAML", () => {
    expect(() => parseCourseYaml(": :", "course.yml")).toThrow(ProtocolError);
  });

  test("throws when the document is not a mapping", () => {
    expect(() => parseCourseYaml("- just a list\n", "course.yml")).toThrow(ProtocolError);
  });
});

describe("validateCourse", () => {
  test("accepts a minimal valid course", () => {
    const course = validateCourse(validConfig, [validChapter], "/tmp/config");
    expect(course.chapters).toHaveLength(1);
    expect(course.configDir).toBe("/tmp/config");
  });

  test("rejects empty chapter lists", () => {
    expect(() => validateCourse(validConfig, [], "/tmp/config")).toThrow(ProtocolError);
  });

  test("rejects blank entry file paths", () => {
    expect(() =>
      validateCourse(
        validConfig,
        [{ ...validChapter, entryFiles: ["src/a.ts", ""] }],
        "/tmp/config",
      ),
    ).toThrow(ProtocolError);
  });
});
