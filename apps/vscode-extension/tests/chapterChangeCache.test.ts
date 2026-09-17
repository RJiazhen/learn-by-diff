import type { ChapterConfig } from "@learn-by-diff/protocol";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { GitClient } from "../src/git/client.ts";
import {
  cacheEntryMatchesChapter,
  readChapterChangeCache,
  sourceStoreRevision,
  upsertCachedChapterChange,
  writeChapterChangeCache,
} from "../src/workspace/chapterChangeCache.ts";
import { learningPaths } from "../src/workspace/paths.ts";

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
 * Builds a minimal chapter config for cache identity tests.
 *
 * @param entryFiles - Optional explicit entry files
 */
function chapter(entryFiles?: string[]): ChapterConfig {
  return {
    id: "hello",
    title: "Hello",
    fromDir: "start",
    toDir: "hello",
    ...(entryFiles !== undefined ? { entryFiles } : {}),
  };
}

describe("chapterChangeCache", () => {
  test("round-trips a compare result under .learn", async () => {
    const root = await tempDir("lbd-cache-ws-");
    const cache = { sourceRev: "abc", chapters: {} };
    upsertCachedChapterChange(cache, chapter(["a.ts"]), {
      hasChanges: true,
      files: [{ relativePath: "a.ts", changeKind: "M" }],
    });
    await writeChapterChangeCache(root, cache);
    const loaded = await readChapterChangeCache(root);
    expect(loaded).toEqual(cache);
  });

  test("returns undefined for missing or invalid files", async () => {
    const root = await tempDir("lbd-cache-bad-");
    expect(await readChapterChangeCache(root)).toBeUndefined();
    const { chapterChangesFile } = learningPaths(root);
    await mkdir(path.dirname(chapterChangesFile), { recursive: true });
    await writeFile(chapterChangesFile, "{not json", "utf8");
    expect(await readChapterChangeCache(root)).toBeUndefined();
    await writeFile(chapterChangesFile, JSON.stringify({ sourceRev: "" }), "utf8");
    expect(await readChapterChangeCache(root)).toBeUndefined();
  });

  test("cacheEntryMatchesChapter requires the same from/to and entryFiles", () => {
    const entry = {
      fromDir: "start",
      toDir: "hello",
      entryFiles: ["a.ts"] as string[] | null,
      hasChanges: true,
    };
    expect(cacheEntryMatchesChapter(chapter(["a.ts"]), entry)).toBe(true);
    expect(cacheEntryMatchesChapter(chapter(["b.ts"]), entry)).toBe(false);
    expect(cacheEntryMatchesChapter(chapter(), entry)).toBe(false);
    expect(cacheEntryMatchesChapter(chapter(["a.ts"]), { ...entry, fromDir: "other" })).toBe(false);
  });

  test("sourceStoreRevision uses git HEAD for a git dir and mtime otherwise", async () => {
    const repo = await tempDir("lbd-cache-git-");
    await git.run(["init"], { cwd: repo });
    await git.run(["checkout", "-b", "main"], { cwd: repo });
    await writeFile(path.join(repo, "a.ts"), "x\n", "utf8");
    await git.run(["add", "-A"], { cwd: repo });
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
        "seed",
      ],
      { cwd: repo },
    );
    const expected = (await git.run(["rev-parse", "HEAD"], { cwd: repo })).stdout.trim();
    const gitDir = path.join(repo, ".git");
    expect(await sourceStoreRevision(git, gitDir)).toBe(expected);

    const plain = await tempDir("lbd-cache-plain-");
    await writeFile(path.join(plain, "file.txt"), "y\n", "utf8");
    await utimes(plain, new Date(1_700_000_000_000), new Date(1_700_000_000_000));
    expect(await sourceStoreRevision(git, plain)).toMatch(/^mtime:/);
  });
});
