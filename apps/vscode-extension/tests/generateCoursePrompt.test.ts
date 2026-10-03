import { describe, expect, test } from "vite-plus/test";
import {
  buildGenerateCoursePrompt,
  GENERATE_COURSE_SNAPSHOT_PATH,
  GENERATE_COURSE_TARGET_FOLDER,
  generateCourseSkillInstallArgs,
} from "../src/author/generateCoursePrompt.ts";

describe("generate course prompt", () => {
  test("includes the snapshot path and target folder placeholders", () => {
    const prompt = buildGenerateCoursePrompt();
    expect(prompt).toContain("/generate-course-config");
    expect(prompt).toContain(`Snapshot path: ${GENERATE_COURSE_SNAPSHOT_PATH}`);
    expect(prompt).toContain("Snapshot path: ./path/to/chapter/code/root/folder");
    expect(prompt).toContain(`Target folder: ${GENERATE_COURSE_TARGET_FOLDER}`);
    expect(prompt).toContain("Target folder: ./course-config");
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
