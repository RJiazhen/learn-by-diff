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
});
