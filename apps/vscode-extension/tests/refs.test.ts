import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { GitClient } from "../src/git/client.ts";
import { createLearningWorkspace } from "../src/workspace/creator.ts";
import { loadLearningSession } from "../src/workspace/loader.ts";
import { chapterRefPath } from "../src/workspace/paths.ts";
import { chapterRefWorkspaceName, materializeChapterRef } from "../src/workspace/refs.ts";

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

describe("chapterRefWorkspaceName", () => {
  test("includes ordinal, title, and status", () => {
    const course = {
      configDir: "/tmp/course",
      config: { id: "demo", title: "Demo", source: { repository: "." } },
      chapters: [
        { id: "skeleton", title: "Canvas skeleton", fromDir: "start", toDir: "skeleton" },
        { id: "particles", title: "Particles", fromDir: "skeleton", toDir: "particles" },
      ],
    };
    expect(chapterRefWorkspaceName(course, "particles", "finish")).toBe("2-Particles (Completed)");
    expect(chapterRefWorkspaceName(course, "skeleton", "start")).toBe(
      "1-Canvas skeleton (Not Started)",
    );
  });
});

describe("materializeChapterRef", () => {
  test("exports start and finish into separate folders without touching the student tree", async () => {
    const pair = await tempDir("lbd-ref-pair-");
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
    await writeFile(path.join(sourceDir, "done", "extra.ts"), "export {};\n", "utf8");

    await mkdir(path.join(courseDir, ".course-config", "chapters"), { recursive: true });
    await writeFile(
      path.join(courseDir, ".course-config", "course.yml"),
      ["id: refs", "title: Refs", "source:", "  repository: ../demo-source", ""].join("\n"),
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

    const parent = await tempDir("lbd-ref-parent-");
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

    const studentBefore = await readFile(path.join(created.learningRoot, "pkg/index.ts"), "utf8");
    const startDir = await materializeChapterRef(git, session, "one", "start");
    const finishDir = await materializeChapterRef(git, session, "one", "finish");

    expect(startDir).toBe(
      chapterRefPath(created.learningRoot, chapterRefWorkspaceName(session.course, "one", "start")),
    );
    expect(path.basename(startDir)).toBe("1-One (Not Started)");
    expect(path.basename(finishDir)).toBe("1-One (Completed)");
    expect(await readFile(path.join(startDir, "pkg/index.ts"), "utf8")).toBe(
      "export const v = 1;\n",
    );
    expect(await readFile(path.join(finishDir, "pkg/index.ts"), "utf8")).toBe(
      "export const v = 2;\n",
    );
    expect(await readFile(path.join(finishDir, "extra.ts"), "utf8")).toBe("export {};\n");
    await expect(access(path.join(startDir, "extra.ts"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(path.join(created.learningRoot, "pkg/index.ts"), "utf8")).toBe(
      studentBefore,
    );

    await writeFile(path.join(finishDir, "stale.ts"), "leftover\n", "utf8");
    await materializeChapterRef(git, session, "one", "finish");
    await expect(access(path.join(finishDir, "stale.ts"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
