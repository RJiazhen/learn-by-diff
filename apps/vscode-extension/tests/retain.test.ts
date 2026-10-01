import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { parseCourseJsonc } from "@learn-by-diff/protocol";
import { ensureBuiltinRetain, isRetainedRelativePath } from "../src/workspace/retain.ts";

const temps: string[] = [];

/**
 * Creates a unique temp directory and schedules it for cleanup.
 */
async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("isRetainedRelativePath", () => {
  test("matches with .gitignore rules, including nested basenames", () => {
    const retain = ["node_modules", "pkg/keep.txt", "/root-only", "*.code-workspace"];
    expect(isRetainedRelativePath("node_modules", retain)).toBe(true);
    expect(isRetainedRelativePath("node_modules/leftpad/index.js", retain)).toBe(true);
    expect(isRetainedRelativePath("packages/app/node_modules/pkg/index.js", retain)).toBe(true);
    expect(isRetainedRelativePath("pkg/keep.txt", retain)).toBe(true);
    expect(isRetainedRelativePath("pkg/index.ts", retain)).toBe(false);
    expect(isRetainedRelativePath("root-only", retain)).toBe(true);
    expect(isRetainedRelativePath("nested/root-only", retain)).toBe(false);
    expect(isRetainedRelativePath("demo.code-workspace", retain)).toBe(true);
    expect(isRetainedRelativePath("nested/demo.code-workspace", retain)).toBe(true);
  });
});

describe("ensureBuiltinRetain", () => {
  test("writes the default plus built-ins when retain is omitted, and keeps comments", async () => {
    const courseDir = await tempDir("lbd-retain-omit-");
    const filePath = path.join(courseDir, "course.jsonc");
    await mkdir(courseDir, { recursive: true });
    await writeFile(
      filePath,
      `{
  // course id
  "id": "demo"
}
`,
      "utf8",
    );

    await ensureBuiltinRetain(courseDir);
    const text = await readFile(filePath, "utf8");
    expect(text).toContain("// course id");
    expect(parseCourseJsonc(text, filePath).retain).toEqual([
      "node_modules",
      ".git",
      ".learn",
      ".gitignore",
      "*.code-workspace",
    ]);

    await ensureBuiltinRetain(courseDir);
    expect(await readFile(filePath, "utf8")).toBe(text);
  });

  test("appends built-ins after an author list and does not add node_modules to an explicit list", async () => {
    const courseDir = await tempDir("lbd-retain-author-");
    const filePath = path.join(courseDir, "course.jsonc");
    await mkdir(courseDir, { recursive: true });
    await writeFile(filePath, '{ "retain": ["target"] }\n', "utf8");

    await ensureBuiltinRetain(courseDir);
    expect(parseCourseJsonc(await readFile(filePath, "utf8"), filePath).retain).toEqual([
      "target",
      ".git",
      ".learn",
      ".gitignore",
      "*.code-workspace",
    ]);
  });

  test("an explicit empty retain becomes only the built-ins", async () => {
    const courseDir = await tempDir("lbd-retain-empty-");
    const filePath = path.join(courseDir, "course.jsonc");
    await mkdir(courseDir, { recursive: true });
    await writeFile(filePath, '{ "retain": [] }\n', "utf8");

    await ensureBuiltinRetain(courseDir);
    expect(parseCourseJsonc(await readFile(filePath, "utf8"), filePath).retain).toEqual([
      ".git",
      ".learn",
      ".gitignore",
      "*.code-workspace",
    ]);
  });
});
