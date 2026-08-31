import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { GitClient } from "../src/git/client.ts";
import { createLearningWorkspace, checkoutChapter } from "../src/workspace/creator.ts";
import { DirtyWorkspaceError } from "../src/workspace/errors.ts";
import {
  findLearningWorkspaceRoot,
  isInPlaceLearningTarget,
  loadLearningSession,
} from "../src/workspace/loader.ts";
import { ensureLearningWorkspaceFile } from "../src/workspace/multiRoot.ts";
import { learningPaths } from "../src/workspace/paths.ts";
import { applyChapterSnapshot } from "../src/workspace/session.ts";
import { readProgress, writeProgress } from "../src/workspace/state.ts";

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

/**
 * Creates a two-chapter course (`start` → `two`) and a learning workspace seeded with `start`.
 */
async function createTwoChapterWorkspace(): Promise<{
  learningRoot: string;
  course: Awaited<ReturnType<typeof createLearningWorkspace>>["course"];
}> {
  const pair = await tempDir("lbd-two-pair-");
  const sourceDir = path.join(pair, "demo-source");
  const courseDir = path.join(pair, "demo-course");
  await mkdir(path.join(sourceDir, "start", "pkg"), { recursive: true });
  await mkdir(path.join(sourceDir, "two", "pkg"), { recursive: true });
  await writeFile(
    path.join(sourceDir, "start", "pkg", "index.ts"),
    "export const v = 1;\n",
    "utf8",
  );
  await writeFile(path.join(sourceDir, "two", "pkg", "index.ts"), "export const v = 2;\n", "utf8");

  await mkdir(path.join(courseDir, ".course-config", "chapters"), { recursive: true });
  await writeFile(
    path.join(courseDir, ".course-config", "course.yml"),
    ["id: twochap", "title: Two", "source:", "  repository: ../demo-source", ""].join("\n"),
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

  const parent = await tempDir("lbd-two-parent-");
  const created = await createLearningWorkspace({
    courseRepoUrl: courseDir,
    parentDir: parent,
    git,
  });
  return { learningRoot: created.learningRoot, course: created.course };
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
      appliedSide: "start",
    });
    const gitignore = await readFile(path.join(created.learningRoot, ".gitignore"), "utf8");
    expect(gitignore).toContain(".learn/source.git/");
    expect(gitignore).toContain(".learn/snapshots/");
    expect(gitignore).toContain(".learn/refs/");
    expect(gitignore).toContain("*.code-workspace");
    expect(gitignore).not.toMatch(/^\.learn\/$/m);
    const createdPaths = learningPaths(created.learningRoot);
    const workspaceJson = JSON.parse(await readFile(createdPaths.workspaceFile, "utf8")) as {
      folders: { name: string; path: string }[];
    };
    expect(path.basename(createdPaths.workspaceFile)).toBe(
      `${path.basename(created.learningRoot)}.code-workspace`,
    );
    expect(workspaceJson.folders).toEqual([
      { name: path.basename(created.learningRoot), path: "." },
    ]);
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

  test("ensureLearningWorkspaceFile does not overwrite an existing workspace file", async () => {
    const root = await tempDir("lbd-ws-keep-");
    const paths = learningPaths(root);
    const existing = '{"folders":[{"path":"."}]}\n';
    await writeFile(paths.workspaceFile, existing, "utf8");
    const result = await ensureLearningWorkspaceFile(root);
    expect(result).toBe(paths.workspaceFile);
    expect(await readFile(paths.workspaceFile, "utf8")).toBe(existing);
  });

  test("ensureLearningWorkspaceFile migrates a legacy .learn workspace file", async () => {
    const root = await tempDir("lbd-ws-mig-");
    const paths = learningPaths(root);
    await mkdir(paths.learnDir, { recursive: true });
    const legacy = {
      folders: [
        { name: "old", path: ".." },
        { name: "refs", path: "refs" },
        { name: "2-Particles (Completed)", path: "refs/2-Particles (Completed)" },
      ],
    };
    await writeFile(paths.legacyWorkspaceFile, `${JSON.stringify(legacy)}\n`, "utf8");
    await ensureLearningWorkspaceFile(root);
    const body = JSON.parse(await readFile(paths.workspaceFile, "utf8")) as {
      folders: { name: string; path: string }[];
    };
    expect(body.folders).toEqual([
      { name: path.basename(root), path: "." },
      { name: "2-Particles (Completed)", path: ".learn/refs/2-Particles (Completed)" },
    ]);
    await expect(access(paths.legacyWorkspaceFile)).resolves.toBeUndefined();
    await ensureLearningWorkspaceFile(root);
    await expect(access(paths.legacyWorkspaceFile)).rejects.toMatchObject({ code: "ENOENT" });
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
    expect(gitignore).toContain(".learn/refs/");
    expect(gitignore).toContain("*.code-workspace");
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
    expect(gitignore).toContain(".learn/refs/");
    expect(gitignore).toContain("*.code-workspace");
    expect(gitignore).not.toContain("from-chapter");
  });

  test("applyChapterSnapshot exports fromDir when the tree still matches the last snapshot", async () => {
    const { learningRoot } = await createTwoChapterWorkspace();
    const session = await loadLearningSession(learningRoot);
    expect(session).toBeDefined();
    if (session === undefined) {
      return;
    }

    await applyChapterSnapshot(git, session, "two", "start");
    expect(await readFile(path.join(learningRoot, "pkg/index.ts"), "utf8")).toBe(
      "export const v = 2;\n",
    );
    await expect(access(learningPaths(learningRoot).workspaceFile)).resolves.toBeUndefined();
    expect(await readProgress(learningRoot)).toEqual({
      chapter: "two",
      completed: false,
      appliedSide: "start",
    });
  });

  test("applyChapterSnapshot exports toDir for finish", async () => {
    const { learningRoot } = await createTwoChapterWorkspace();
    const session = await loadLearningSession(learningRoot);
    expect(session).toBeDefined();
    if (session === undefined) {
      return;
    }

    await applyChapterSnapshot(git, session, "one", "finish");
    expect(await readFile(path.join(learningRoot, "pkg/index.ts"), "utf8")).toBe(
      "export const v = 2;\n",
    );
    expect(await readProgress(learningRoot)).toEqual({
      chapter: "one",
      completed: false,
      appliedSide: "finish",
    });
  });

  test("applyChapterSnapshot replaces the student tree instead of merging snapshots", async () => {
    const pair = await tempDir("lbd-replace-pair-");
    const sourceDir = path.join(pair, "demo-source");
    const courseDir = path.join(pair, "demo-course");
    await mkdir(path.join(sourceDir, "start", "src"), { recursive: true });
    await mkdir(path.join(sourceDir, "done", "src", "particle"), { recursive: true });
    await writeFile(
      path.join(sourceDir, "start", "src", "main.ts"),
      "export const v = 1;\n",
      "utf8",
    );
    await writeFile(path.join(sourceDir, "start", "README.md"), "# start docs\n", "utf8");
    await writeFile(
      path.join(sourceDir, "done", "src", "main.ts"),
      "export const v = 2;\n",
      "utf8",
    );
    await writeFile(
      path.join(sourceDir, "done", "src", "particle", "field.ts"),
      "export {};\n",
      "utf8",
    );
    await writeFile(path.join(sourceDir, "done", "docs.md"), "finish notes\n", "utf8");

    await mkdir(path.join(courseDir, ".course-config", "chapters"), { recursive: true });
    await writeFile(
      path.join(courseDir, ".course-config", "course.yml"),
      ["id: replace", "title: Replace", "source:", "  repository: ../demo-source", ""].join("\n"),
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
        "  - src/main.ts",
        "",
      ].join("\n"),
      "utf8",
    );

    const parent = await tempDir("lbd-replace-parent-");
    const created = await createLearningWorkspace({
      courseRepoUrl: courseDir,
      parentDir: parent,
      git,
    });
    const session = await loadLearningSession(created.learningRoot);
    expect(session).toBeDefined();
    if (session === undefined) {
      return;
    }

    await applyChapterSnapshot(git, session, "one", "finish");
    expect(await readFile(path.join(created.learningRoot, "src/particle/field.ts"), "utf8")).toBe(
      "export {};\n",
    );
    expect(await readFile(path.join(created.learningRoot, "docs.md"), "utf8")).toBe(
      "finish notes\n",
    );
    await expect(access(path.join(created.learningRoot, "README.md"))).rejects.toMatchObject({
      code: "ENOENT",
    });

    await applyChapterSnapshot(git, session, "one", "start");
    expect(await readFile(path.join(created.learningRoot, "src/main.ts"), "utf8")).toBe(
      "export const v = 1;\n",
    );
    expect(await readFile(path.join(created.learningRoot, "README.md"), "utf8")).toBe(
      "# start docs\n",
    );
    await expect(
      access(path.join(created.learningRoot, "src/particle/field.ts")),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(path.join(created.learningRoot, "docs.md"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  test("applyChapterSnapshot throws when the student tree differs from the last snapshot", async () => {
    const { learningRoot } = await createTwoChapterWorkspace();
    await writeFile(
      path.join(learningRoot, "pkg/index.ts"),
      "export const v = 1;\n// dirty\n",
      "utf8",
    );
    const session = await loadLearningSession(learningRoot);
    expect(session).toBeDefined();
    if (session === undefined) {
      return;
    }

    await expect(applyChapterSnapshot(git, session, "two", "start")).rejects.toBeInstanceOf(
      DirtyWorkspaceError,
    );
    expect(await readFile(path.join(learningRoot, "pkg/index.ts"), "utf8")).toContain("dirty");

    await applyChapterSnapshot(git, session, "two", "start", true);
    expect(await readFile(path.join(learningRoot, "pkg/index.ts"), "utf8")).toBe(
      "export const v = 2;\n",
    );
  });

  test("loadLearningSession defaults appliedSide to start", async () => {
    const { learningRoot } = await createTwoChapterWorkspace();
    await writeProgress(learningRoot, { chapter: "one", completed: false });
    const session = await loadLearningSession(learningRoot);
    expect(session?.progress).toEqual({
      chapter: "one",
      completed: false,
      appliedSide: "start",
    });
  });

  test("isInPlaceLearningTarget allows README-only folders", async () => {
    const dir = await tempDir("lbd-empty-");
    await writeFile(path.join(dir, "README.md"), "sandbox\n", "utf8");
    expect(await isInPlaceLearningTarget(dir)).toBe(true);
  });

  test("isInPlaceLearningTarget ignores a generated .code-workspace file", async () => {
    const dir = await tempDir("lbd-ws-empty-");
    await writeFile(path.join(dir, "README.md"), "sandbox\n", "utf8");
    await writeFile(path.join(dir, `${path.basename(dir)}.code-workspace`), "{}\n", "utf8");
    expect(await isInPlaceLearningTarget(dir)).toBe(true);
  });

  test("findLearningWorkspaceRoot picks the folder that has progress.json", async () => {
    const { learningRoot } = await createTwoChapterWorkspace();
    const decoy = await tempDir("lbd-decoy-");
    await writeFile(path.join(decoy, "README.md"), "not a learning workspace\n", "utf8");
    expect(await findLearningWorkspaceRoot([decoy, learningRoot])).toBe(learningRoot);
    expect(await findLearningWorkspaceRoot([decoy])).toBeUndefined();
  });
});
