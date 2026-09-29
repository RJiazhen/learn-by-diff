import path from "node:path";
import { describe, expect, test } from "vite-plus/test";
import {
  demoCoursePath,
  isRemoteGitUrl,
  resolveSourceRepository,
} from "../src/workspace/resolveRepo.ts";

describe("resolveSourceRepository", () => {
  test("keeps remote URLs and absolute paths", () => {
    expect(resolveSourceRepository("https://github.com/a/b.git", "/tmp/course")).toBe(
      "https://github.com/a/b.git",
    );
    expect(resolveSourceRepository("/abs/source", "/tmp/course")).toBe("/abs/source");
  });

  test("resolves relative paths against the directory that contains course.yml", () => {
    expect(
      resolveSourceRepository("../demo-source", "/repo/examples/demo-course/.course-config"),
    ).toBe(path.resolve("/repo/examples/demo-course/.course-config", "../demo-source"));
    expect(
      resolveSourceRepository("../../demo-source", "/repo/examples/demo-course/.course-config"),
    ).toBe(path.resolve("/repo/examples/demo-course/.course-config", "../../demo-source"));
  });

  test("treats omitted and . as the config directory", () => {
    const configDir = "/repo/examples/demo-course/.course-config";
    expect(resolveSourceRepository("", configDir)).toBe(path.resolve(configDir));
    expect(resolveSourceRepository(".", configDir)).toBe(path.resolve(configDir));
  });

  test("detects remote git URLs", () => {
    expect(isRemoteGitUrl("https://github.com/a/b.git")).toBe(true);
    expect(isRemoteGitUrl("git@github.com:a/b.git")).toBe(true);
    expect(isRemoteGitUrl("/tmp/course")).toBe(false);
  });

  test("demoCoursePath points at examples/demo-course/.course-config/course.yml", () => {
    expect(demoCoursePath("/repo/apps/vscode-extension")).toBe(
      path.resolve("/repo/examples/demo-course/.course-config/course.yml"),
    );
  });
});
