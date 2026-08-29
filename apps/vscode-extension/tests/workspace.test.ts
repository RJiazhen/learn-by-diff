import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { GitClient } from "../src/git/client.ts";
import { createLearningWorkspace } from "../src/workspace/creator.ts";
import { isInPlaceLearningTarget, loadLearningSession } from "../src/workspace/loader.ts";
import { learningPaths } from "../src/workspace/paths.ts";
import { readProgress } from "../src/workspace/state.ts";

const git = new GitClient();
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

/**
 * Writes files and creates a git commit on `branch`.
 */
async function commitTree(
  dir: string,
  files: Record<string, string>,
  message: string,
): Promise<void> {
  for (const [relative, contents] of Object.entries(files)) {
    const full = path.join(dir, relative);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, contents, "utf8");
  }
  await git.run(["add", "-A"], { cwd: dir });
  await git.run(
    [
      "-c",
      "user.email=test@local",
      "-c",
      "user.name=Test",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "-m",
      message,
    ],
    { cwd: dir },
  );
}

describe("learning workspace", () => {
  test("createLearningWorkspace exports fromRef and records progress", async () => {
    const source = await tempDir("lbd-source-");
    await git.run(["init"], { cwd: source });
    await git.run(["checkout", "-b", "from"], { cwd: source });
    await commitTree(source, { "pkg/index.ts": "export const v = 1;\n" }, "from");
    await git.run(["checkout", "-b", "to"], { cwd: source });
    await commitTree(source, { "pkg/index.ts": "export const v = 2;\n" }, "to");

    const course = await tempDir("lbd-course-");
    await mkdir(path.join(course, ".course-config", "chapters"), { recursive: true });
    await writeFile(
      path.join(course, ".course-config", "course.yml"),
      [
        "protocolVersion: 1",
        "id: demo",
        "title: Demo",
        "source:",
        `  repository: ${source}`,
        "workspace:",
        '  install: "true"',
        '  dev: "true"',
        '  test: "true"',
        "",
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      path.join(course, ".course-config", "chapters", "001.yml"),
      [
        "id: one",
        "title: One",
        "fromRef: from",
        "toRef: to",
        "entryFiles:",
        "  - pkg/index.ts",
        "tests:",
        "  - pkg/index.ts",
        "",
      ].join("\n"),
      "utf8",
    );
    await git.run(["init"], { cwd: course });
    await git.run(["add", "-A"], { cwd: course });
    await git.run(
      [
        "-c",
        "user.email=test@local",
        "-c",
        "user.name=Test",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "-m",
        "course",
      ],
      { cwd: course },
    );

    const parent = await tempDir("lbd-parent-");
    const created = await createLearningWorkspace({
      courseRepoUrl: course,
      parentDir: parent,
      git,
      runInstall: async () => {},
    });

    expect(path.basename(created.learningRoot)).toBe("demo");
    expect(await readFile(path.join(created.learningRoot, "pkg/index.ts"), "utf8")).toBe(
      "export const v = 1;\n",
    );
    expect(await readProgress(created.learningRoot)).toEqual({
      chapter: "one",
      completed: false,
    });
    const session = await loadLearningSession(created.learningRoot);
    expect(session?.course.config.id).toBe("demo");
    expect(learningPaths(created.learningRoot).sourceMirror.length).toBeGreaterThan(0);
  });

  test("isInPlaceLearningTarget allows README-only folders", async () => {
    const dir = await tempDir("lbd-empty-");
    await writeFile(path.join(dir, "README.md"), "sandbox\n", "utf8");
    expect(await isInPlaceLearningTarget(dir)).toBe(true);
  });
});
