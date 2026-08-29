import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { GitClient } from "../src/git/client.ts";
import { createLearningWorkspace, checkoutChapter } from "../src/workspace/creator.ts";
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
 * Writes files and creates a single commit on main.
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
  test("createLearningWorkspace exports fromDir and records progress", async () => {
    const source = await tempDir("lbd-source-");
    await git.run(["init"], { cwd: source });
    await git.run(["checkout", "-b", "main"], { cwd: source });
    await commitTree(
      source,
      {
        "start/pkg/index.ts": "export const v = 1;\n",
        "done/pkg/index.ts": "export const v = 2;\n",
      },
      "chapter dirs",
    );

    const course = await tempDir("lbd-course-");
    await mkdir(path.join(course, ".course-config", "chapters"), { recursive: true });
    await writeFile(
      path.join(course, ".course-config", "course.yml"),
      ["id: demo", "title: Demo", "source:", `  repository: ${source}`, ""].join("\n"),
      "utf8",
    );
    await writeFile(
      path.join(course, ".course-config", "chapters", "001.yml"),
      [
        "id: one",
        "title: One",
        "fromDir: start",
        "toDir: done",
        "entryFiles:",
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
    });

    expect(path.basename(created.learningRoot)).toBe("demo");
    expect(await readFile(path.join(created.learningRoot, "pkg/index.ts"), "utf8")).toBe(
      "export const v = 1;\n",
    );
    expect(await readProgress(created.learningRoot)).toEqual({
      chapter: "one",
      completed: false,
    });
    const gitignore = await readFile(path.join(created.learningRoot, ".gitignore"), "utf8");
    expect(gitignore).toContain(".learn/source.git/");
    expect(gitignore).toContain(".learn/snapshots/");
    expect(gitignore).not.toMatch(/^\.learn\/$/m);
    const session = await loadLearningSession(created.learningRoot);
    expect(session?.course.config.id).toBe("demo");
    expect(learningPaths(created.learningRoot).sourceMirror.length).toBeGreaterThan(0);
    await expect(
      stat(path.join(created.learningRoot, ".git")).then(
        () => true,
        () => false,
      ),
    ).resolves.toBe(false);
  });

  test("createLearningWorkspace accepts plain local directories without nested git", async () => {
    const pair = await tempDir("lbd-plain-pair-");
    const sourceDir = path.join(pair, "demo-source");
    const courseDir = path.join(pair, "demo-course");
    await mkdir(path.join(sourceDir, "start", "pkg"), { recursive: true });
    await mkdir(path.join(sourceDir, "done", "pkg"), { recursive: true });
    await writeFile(
      path.join(sourceDir, "start", "pkg", "index.ts"),
      "export const v = 1;\n",
      "utf8",
    );
    await writeFile(
      path.join(sourceDir, "done", "pkg", "index.ts"),
      "export const v = 2;\n",
      "utf8",
    );

    await mkdir(path.join(courseDir, ".course-config", "chapters"), { recursive: true });
    await writeFile(
      path.join(courseDir, ".course-config", "course.yml"),
      ["id: plain", "title: Plain", "source:", "  repository: ../demo-source", ""].join("\n"),
      "utf8",
    );
    await writeFile(
      path.join(courseDir, ".course-config", "chapters", "001.yml"),
      [
        "id: one",
        "title: One",
        "fromDir: start",
        "toDir: done",
        "entryFiles:",
        "  - pkg/index.ts",
        "",
      ].join("\n"),
      "utf8",
    );

    const parent = await tempDir("lbd-plain-parent-");
    const created = await createLearningWorkspace({
      courseRepoUrl: courseDir,
      parentDir: parent,
      git,
    });

    expect(path.basename(created.learningRoot)).toBe("plain");
    expect(await readFile(path.join(created.learningRoot, "pkg/index.ts"), "utf8")).toBe(
      "export const v = 1;\n",
    );
  });

  test("createLearningWorkspace merges learn ignore rules into an existing .gitignore", async () => {
    const pair = await tempDir("lbd-merge-gi-");
    const sourceDir = path.join(pair, "demo-source");
    const courseDir = path.join(pair, "demo-course");
    await mkdir(path.join(sourceDir, "start", "pkg"), { recursive: true });
    await mkdir(path.join(sourceDir, "done", "pkg"), { recursive: true });
    await writeFile(
      path.join(sourceDir, "start", "pkg", "index.ts"),
      "export const v = 1;\n",
      "utf8",
    );
    await writeFile(
      path.join(sourceDir, "done", "pkg", "index.ts"),
      "export const v = 2;\n",
      "utf8",
    );
    await writeFile(path.join(sourceDir, "start", ".gitignore"), "from-chapter\n", "utf8");

    await mkdir(path.join(courseDir, ".course-config", "chapters"), { recursive: true });
    await writeFile(
      path.join(courseDir, ".course-config", "course.yml"),
      ["id: mergegi", "title: Merge", "source:", "  repository: ../demo-source", ""].join("\n"),
      "utf8",
    );
    await writeFile(
      path.join(courseDir, ".course-config", "chapters", "001.yml"),
      [
        "id: one",
        "title: One",
        "fromDir: start",
        "toDir: done",
        "entryFiles:",
        "  - pkg/index.ts",
        "",
      ].join("\n"),
      "utf8",
    );

    const inPlace = await tempDir("lbd-merge-gi-root-");
    await writeFile(path.join(inPlace, "README.md"), "sandbox\n", "utf8");
    await writeFile(path.join(inPlace, ".gitignore"), "keep-me\ndist/\n", "utf8");

    const created = await createLearningWorkspace({
      courseRepoUrl: courseDir,
      inPlaceRoot: inPlace,
      git,
    });

    const gitignore = await readFile(path.join(created.learningRoot, ".gitignore"), "utf8");
    expect(gitignore).toContain("keep-me");
    expect(gitignore).toContain("dist/");
    expect(gitignore).toContain(".learn/source.git/");
    expect(gitignore).toContain(".learn/snapshots/");
    expect(gitignore).not.toContain("from-chapter");
  });

  test("checkoutChapter preserves workspace .gitignore across chapter export", async () => {
    const pair = await tempDir("lbd-gi-pair-");
    const sourceDir = path.join(pair, "demo-source");
    const courseDir = path.join(pair, "demo-course");
    await mkdir(path.join(sourceDir, "start", "pkg"), { recursive: true });
    await mkdir(path.join(sourceDir, "two", "pkg"), { recursive: true });
    await writeFile(
      path.join(sourceDir, "start", "pkg", "index.ts"),
      "export const v = 1;\n",
      "utf8",
    );
    await writeFile(
      path.join(sourceDir, "two", "pkg", "index.ts"),
      "export const v = 2;\n",
      "utf8",
    );
    await writeFile(path.join(sourceDir, "two", ".gitignore"), "from-chapter\n", "utf8");

    await mkdir(path.join(courseDir, ".course-config", "chapters"), { recursive: true });
    await writeFile(
      path.join(courseDir, ".course-config", "course.yml"),
      ["id: gi", "title: Gitignore", "source:", "  repository: ../demo-source", ""].join("\n"),
      "utf8",
    );
    await writeFile(
      path.join(courseDir, ".course-config", "chapters", "001.yml"),
      [
        "id: one",
        "title: One",
        "fromDir: start",
        "toDir: two",
        "entryFiles:",
        "  - pkg/index.ts",
        "",
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      path.join(courseDir, ".course-config", "chapters", "002.yml"),
      [
        "id: two",
        "title: Two",
        "fromDir: two",
        "toDir: two",
        "entryFiles:",
        "  - pkg/index.ts",
        "",
      ].join("\n"),
      "utf8",
    );

    const parent = await tempDir("lbd-gi-parent-");
    const created = await createLearningWorkspace({
      courseRepoUrl: courseDir,
      parentDir: parent,
      git,
    });

    await writeFile(
      path.join(created.learningRoot, ".gitignore"),
      "custom-keep\n.learn/source.git/\n.learn/snapshots/\nnode_modules/\n",
      "utf8",
    );

    await checkoutChapter(git, created.learningRoot, created.course, "two");
    const gitignore = await readFile(path.join(created.learningRoot, ".gitignore"), "utf8");
    expect(gitignore).toContain("custom-keep");
    expect(gitignore).not.toContain("from-chapter");
  });

  test("isInPlaceLearningTarget allows README-only folders", async () => {
    const dir = await tempDir("lbd-empty-");
    await writeFile(path.join(dir, "README.md"), "sandbox\n", "utf8");
    expect(await isInPlaceLearningTarget(dir)).toBe(true);
  });
});
