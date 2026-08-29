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

  test("resolves relative paths against the local course origin", () => {
    expect(resolveSourceRepository("../demo-source", "/repo/examples/demo-course")).toBe(
      path.resolve("/repo/examples/demo-course", "../demo-source"),
    );
  });

  test("detects remote git URLs", () => {
    expect(isRemoteGitUrl("https://github.com/a/b.git")).toBe(true);
    expect(isRemoteGitUrl("git@github.com:a/b.git")).toBe(true);
    expect(isRemoteGitUrl("/tmp/course")).toBe(false);
  });

  test("demoCoursePath points at examples/demo-course", () => {
    expect(demoCoursePath("/repo/apps/vscode-extension")).toBe(
      path.resolve("/repo/examples/demo-course"),
    );
  });
});
