import path from "node:path";
import { describe, expect, test } from "vite-plus/test";
import {
  buildGenerateCoursePrompt,
  GENERATE_COURSE_SNAPSHOT_PATH,
  generateCourseSkillInstallArgs,
  generateCourseTargetFolder,
} from "../src/author/generateCoursePrompt.ts";

describe("generate course prompt", () => {
  test("uses an absolute path for the target folder", () => {
    const snapshotRoot = path.resolve("/snapshots");
    const targetFolder = generateCourseTargetFolder(snapshotRoot);
    const prompt = buildGenerateCoursePrompt(snapshotRoot);
    expect(path.isAbsolute(targetFolder)).toBe(true);
    expect(targetFolder).toBe(path.resolve(snapshotRoot, "course-config"));
    expect(prompt).toContain("/generate-course-config");
    expect(prompt).toContain(`Snapshot path: ${GENERATE_COURSE_SNAPSHOT_PATH}`);
    expect(prompt).toContain("Snapshot path: ./path/to/chapter/code/root/folder");
    expect(prompt).toContain(`Target folder: ${targetFolder}`);
  });

  test("installs generate-course-config without prompts", () => {
    expect(generateCourseSkillInstallArgs()).toEqual([
      "skills",
      "add",
      "RJiazhen/learn-by-diff@generate-course-config",
      "-y",
    ]);
  });
});
