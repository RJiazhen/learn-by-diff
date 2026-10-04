import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  chapterConfigDownloadRecordFromCourse,
  downloadChapterConfigFiles,
  githubContentsUrl,
  githubRawCourseJsoncUrl,
  readChapterConfigDownloadRecord,
  removeChapterConfigDownloadRecord,
  writeChapterConfigDownloadRecord,
} from "../src/workspace/chapterConfigDownload.ts";

const temps: string[] = [];
const courseUrl =
  "https://github.com/RJiazhen/learn-by-diff-courses/blob/main/chibivue-zh-cn/course.jsonc";
const courseJsonc = `{
  "id": "chibivue-zh-cn",
  "title": "chibivue",
  "chaptersDir": "chapters"
}
`;

/**
 * Creates a temp directory and schedules it for cleanup.
 */
async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "lbd-chapter-config-"));
  temps.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("chapterConfigDownloadRecordFromCourse", () => {
  test("records a GitHub course.jsonc without downloading chapter files", () => {
    expect(chapterConfigDownloadRecordFromCourse(courseUrl, courseJsonc)).toEqual({
      completed: false,
      owner: "RJiazhen",
      repo: "learn-by-diff-courses",
      ref: "main",
      chaptersDir: "chapters",
      chaptersRelPath: "chibivue-zh-cn/chapters",
    });
    expect(githubRawCourseJsoncUrl(courseUrl)).toBe(
      "https://raw.githubusercontent.com/RJiazhen/learn-by-diff-courses/main/chibivue-zh-cn/course.jsonc",
    );
  });
});

describe("downloadChapterConfigFiles", () => {
  test("writes chapter JSONC files and the caller can remove the pending record", async () => {
    const record = chapterConfigDownloadRecordFromCourse(courseUrl, courseJsonc);
    expect(record).toBeDefined();
    if (record === undefined) {
      return;
    }
    const workspaceRoot = await tempDir();
    await writeChapterConfigDownloadRecord(workspaceRoot, record);
    expect(await readChapterConfigDownloadRecord(workspaceRoot)).toEqual(record);

    const chaptersDir = path.join(workspaceRoot, "chapters");
    /**
     * Returns the GitHub directory listing for the recorded chapters path.
     *
     * @param url - Contents API URL
     */
    async function fetchJson(url: string): Promise<unknown> {
      expect(url).toBe(githubContentsUrl(record!));
      return [
        { name: "001-start.jsonc", type: "file" },
        { name: "notes.md", type: "file" },
      ];
    }
    /**
     * Returns one chapter file body.
     *
     * @param url - Raw file URL
     */
    async function fetchText(url: string): Promise<string> {
      expect(url).toContain("001-start.jsonc");
      return '{ "id": "start" }\n';
    }

    await downloadChapterConfigFiles(record, chaptersDir, fetchJson, fetchText);
    expect(await readFile(path.join(chaptersDir, "001-start.jsonc"), "utf8")).toBe(
      '{ "id": "start" }\n',
    );
    await expect(readFile(path.join(chaptersDir, "notes.md"), "utf8")).rejects.toThrow();

    await removeChapterConfigDownloadRecord(workspaceRoot);
    expect(await readChapterConfigDownloadRecord(workspaceRoot)).toBeUndefined();
  });

  test("downloads the first chapter alone, then the rest in parallel", async () => {
    const record = chapterConfigDownloadRecordFromCourse(courseUrl, courseJsonc);
    expect(record).toBeDefined();
    if (record === undefined) {
      return;
    }
    const chaptersDir = path.join(await tempDir(), "chapters");
    let inFlight = 0;
    let maxInFlightAfterFirst = 0;
    let firstCompleted = false;
    const startedAfterFirst: string[] = [];
    const completed: string[] = [];
    let listed: readonly string[] | undefined;

    /**
     * Returns an unsorted GitHub directory listing so the downloader must sort.
     */
    async function fetchJson(): Promise<unknown> {
      return [
        { name: "003-c.jsonc", type: "file" },
        { name: "002-b.jsonc", type: "file" },
        { name: "001-a.jsonc", type: "file" },
      ];
    }

    /**
     * Delays each fetch so overlapping later downloads can be observed.
     *
     * @param url - Raw file URL
     */
    async function fetchText(url: string): Promise<string> {
      const name = url.includes("001-a.jsonc")
        ? "001-a.jsonc"
        : url.includes("002-b.jsonc")
          ? "002-b.jsonc"
          : "003-c.jsonc";
      if (firstCompleted) {
        startedAfterFirst.push(name);
      }
      inFlight += 1;
      if (firstCompleted) {
        maxInFlightAfterFirst = Math.max(maxInFlightAfterFirst, inFlight);
      }
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 30);
      });
      inFlight -= 1;
      if (name === "001-a.jsonc") {
        return '{ "id": "a" }\n';
      }
      if (name === "002-b.jsonc") {
        return '{ "id": "b" }\n';
      }
      return '{ "id": "c" }\n';
    }

    await downloadChapterConfigFiles(record, chaptersDir, fetchJson, fetchText, {
      /**
       * Captures sorted names before downloads start.
       *
       * @param names - Chapter JSONC basenames
       */
      onChapterNames: (names) => {
        listed = names;
      },
      /**
       * Records each file after it is written.
       *
       * @param fileName - Chapter JSONC basename
       */
      onChapterFile: async (fileName) => {
        completed.push(fileName);
        if (fileName === "001-a.jsonc") {
          firstCompleted = true;
        }
      },
    });

    expect(listed).toEqual(["001-a.jsonc", "002-b.jsonc", "003-c.jsonc"]);
    expect(completed[0]).toBe("001-a.jsonc");
    expect(new Set(completed)).toEqual(new Set(["001-a.jsonc", "002-b.jsonc", "003-c.jsonc"]));
    expect(startedAfterFirst).toEqual(expect.arrayContaining(["002-b.jsonc", "003-c.jsonc"]));
    expect(maxInFlightAfterFirst).toBeGreaterThan(1);
    expect(await readFile(path.join(chaptersDir, "001-a.jsonc"), "utf8")).toBe('{ "id": "a" }\n');
  });
});
