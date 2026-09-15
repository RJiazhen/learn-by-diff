import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { GitClient } from "../src/git/client.ts";
import {
  sourceSnapshotIsReady,
  uniqueSourceSubtrees,
  writeChapterArchives,
} from "../src/snapshot/archive.ts";
import {
  prefetchAllChapterSnapshots,
  type SnapshotPrefetchProgress,
} from "../src/snapshot/prefetch.ts";
import { checkoutChapter, createLearningWorkspace } from "../src/workspace/creator.ts";
import { loadLearningSession } from "../src/workspace/loader.ts";
import { learningPaths, sourceSnapshotDir } from "../src/workspace/paths.ts";
import { materializeChapterRef } from "../src/workspace/refs.ts";

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
 * Creates a two-chapter course and a learning workspace seeded with chapter one.
 *
 * Chapter two reuses chapter one's `toDir` (`two`) as both `fromDir` and `toDir`.
 */
async function createTwoChapterWorkspace(): Promise<{
  learningRoot: string;
  course: Awaited<ReturnType<typeof createLearningWorkspace>>["course"];
}> {
  const pair = await tempDir("lbd-prefetch-pair-");
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
  await writeFile(path.join(sourceDir, "two", "extra.ts"), "export {};\n", "utf8");

  await mkdir(path.join(courseDir, ".course-config", "chapters"), { recursive: true });
  await writeFile(
    path.join(courseDir, ".course-config", "course.yml"),
    ["id: prefetch", "title: Prefetch", "source:", "  repository: ../demo-source", ""].join("\n"),
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

  const parent = await tempDir("lbd-prefetch-parent-");
  const created = await createLearningWorkspace({
    courseRepoUrl: path.join(courseDir, ".course-config", "course.yml"),
    parentDir: parent,
    git,
  });
  return { learningRoot: created.learningRoot, course: created.course };
}

describe("chapter snapshot prefetch", () => {
  test("createLearningWorkspace does not block on caching every snapshot", async () => {
    const { learningRoot } = await createTwoChapterWorkspace();
    expect(await sourceSnapshotIsReady(learningRoot, "start")).toBe(false);
    expect(await sourceSnapshotIsReady(learningRoot, "two")).toBe(false);
    expect(await readFile(path.join(learningRoot, "pkg/index.ts"), "utf8")).toBe(
      "export const v = 1;\n",
    );
  });

  test("prefetch writes each unique source tree once and reports progress", async () => {
    const { learningRoot, course } = await createTwoChapterWorkspace();
    const session = await loadLearningSession(learningRoot);
    expect(session).toBeDefined();
    if (session === undefined) {
      return;
    }

    expect(uniqueSourceSubtrees(course)).toEqual(["start", "two"]);

    const logs: string[] = [];
    const reports: SnapshotPrefetchProgress[] = [];
    /**
     * Records prefetch log lines for assertions.
     *
     * @param line - Message from prefetch
     */
    const onLog = (line: string): void => {
      logs.push(line);
    };
    /**
     * Records per-tree download progress for assertions.
     *
     * @param info - Trees completed and the subtree just written
     */
    const onProgress = (info: SnapshotPrefetchProgress): void => {
      reports.push(info);
    };
    await prefetchAllChapterSnapshots(git, session, { onLog, onProgress });

    expect(await sourceSnapshotIsReady(learningRoot, "start")).toBe(true);
    expect(await sourceSnapshotIsReady(learningRoot, "two")).toBe(true);
    const cachedDirs = await readdir(path.join(learningPaths(learningRoot).snapshotsDir, "dirs"));
    expect(cachedDirs.sort()).toEqual(["start", "two"]);
    expect(logs.some((line) => line.includes("Prefetching 2 snapshot"))).toBe(true);
    expect(logs.some((line) => line.includes("Finished prefetching"))).toBe(true);
    expect(reports.map((info) => info.subtree)).toEqual(["start", "two"]);
    expect(reports[1]?.completed).toBe(2);
    expect(reports[1]?.total).toBe(2);

    const startDir = sourceSnapshotDir(learningRoot, "start");
    await writeFile(path.join(startDir, "marker.txt"), "keep\n", "utf8");
    const { sourceMirror } = learningPaths(learningRoot);
    const first = await writeChapterArchives(
      git,
      sourceMirror,
      learningRoot,
      "start",
      "two",
      course.config.source,
    );
    const second = await writeChapterArchives(
      git,
      sourceMirror,
      learningRoot,
      "two",
      "two",
      course.config.source,
    );
    expect(await readFile(path.join(startDir, "marker.txt"), "utf8")).toBe("keep\n");
    expect(first.toDir).toBe(second.fromDir);
    expect(second.fromDir).toBe(second.toDir);

    await rm(sourceMirror, { recursive: true, force: true });
    await checkoutChapter(git, learningRoot, course, "two");
    expect(await readFile(path.join(learningRoot, "pkg/index.ts"), "utf8")).toBe(
      "export const v = 2;\n",
    );
    expect(await readFile(path.join(learningRoot, "extra.ts"), "utf8")).toBe("export {};\n");

    const refDir = await materializeChapterRef(git, session, "one", "start");
    expect(await readFile(path.join(refDir, "pkg/index.ts"), "utf8")).toBe("export const v = 1;\n");
    await expect(access(path.join(refDir, "extra.ts"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("prefetch stops between trees when aborted", async () => {
    const { learningRoot } = await createTwoChapterWorkspace();
    const session = await loadLearningSession(learningRoot);
    expect(session).toBeDefined();
    if (session === undefined) {
      return;
    }

    const abort = new AbortController();
    abort.abort();
    await prefetchAllChapterSnapshots(git, session, { signal: abort.signal });

    expect(await sourceSnapshotIsReady(learningRoot, "start")).toBe(false);
    expect(await sourceSnapshotIsReady(learningRoot, "two")).toBe(false);
  });
});
