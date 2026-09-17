import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ChapterConfig } from "@learn-by-diff/protocol";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { GitClient } from "../src/git/client.ts";
import {
  chapterFromToShareSnapshot,
  classifyEntryChange,
  listChangedFilesInSnapshots,
  snapshotsHaveAnyChange,
} from "../src/workspace/entryChange.ts";

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

describe("classifyEntryChange", () => {
  test("classifies added, deleted, and modified files in a tree store", async () => {
    const store = await tempDir("lbd-change-");
    await mkdir(path.join(store, "from", "src"), { recursive: true });
    await mkdir(path.join(store, "to", "src"), { recursive: true });
    await writeFile(path.join(store, "from", "src", "keep.ts"), "a\n", "utf8");
    await writeFile(path.join(store, "to", "src", "keep.ts"), "b\n", "utf8");
    await writeFile(path.join(store, "from", "src", "gone.ts"), "x\n", "utf8");
    await writeFile(path.join(store, "to", "src", "new.ts"), "y\n", "utf8");
    await writeFile(path.join(store, "from", "src", "same.ts"), "z\n", "utf8");
    await writeFile(path.join(store, "to", "src", "same.ts"), "z\n", "utf8");

    expect(await classifyEntryChange(git, store, "from", "to", "src/new.ts")).toBe("U");
    expect(await classifyEntryChange(git, store, "from", "to", "src/gone.ts")).toBe("D");
    expect(await classifyEntryChange(git, store, "from", "to", "src/keep.ts")).toBe("M");
    expect(await classifyEntryChange(git, store, "from", "to", "src/same.ts")).toBeUndefined();
  });

  test("listChangedFilesInSnapshots compares two cached trees in parallel", async () => {
    const fromRoot = await tempDir("lbd-snap-from-");
    const toRoot = await tempDir("lbd-snap-to-");
    await mkdir(path.join(fromRoot, "src"), { recursive: true });
    await mkdir(path.join(toRoot, "src"), { recursive: true });
    await writeFile(path.join(fromRoot, "src", "keep.ts"), "a\n", "utf8");
    await writeFile(path.join(toRoot, "src", "keep.ts"), "b\n", "utf8");
    await writeFile(path.join(fromRoot, "src", "gone.ts"), "x\n", "utf8");
    await writeFile(path.join(toRoot, "src", "new.ts"), "y\n", "utf8");
    await writeFile(path.join(fromRoot, "src", "same.ts"), "z\n", "utf8");
    await writeFile(path.join(toRoot, "src", "same.ts"), "z\n", "utf8");

    const discovered = await listChangedFilesInSnapshots(fromRoot, toRoot);
    expect(discovered).toEqual([
      { relativePath: "src/keep.ts", changeKind: "M" },
      { relativePath: "src/new.ts", changeKind: "U" },
    ]);

    const explicit = await listChangedFilesInSnapshots(fromRoot, toRoot, [
      "src/new.ts",
      "src/gone.ts",
      "src/keep.ts",
      "src/same.ts",
    ]);
    expect(explicit).toEqual([
      { relativePath: "src/new.ts", changeKind: "U" },
      { relativePath: "src/gone.ts", changeKind: "D" },
      { relativePath: "src/keep.ts", changeKind: "M" },
    ]);
  });
});

describe("chapterFromToShareSnapshot", () => {
  const source = { repository: "." };

  test("is true when fromDir and toDir resolve to the same tree", () => {
    const same: ChapterConfig = { id: "c", title: "c", fromDir: "start", toDir: "start" };
    const empty: ChapterConfig = { id: "c", title: "c", fromDir: "", toDir: "" };
    expect(chapterFromToShareSnapshot(source, same)).toBe(true);
    expect(chapterFromToShareSnapshot(source, empty)).toBe(true);
    expect(chapterFromToShareSnapshot({ repository: ".", root: "learn" }, same)).toBe(true);
  });

  test("is false when fromDir and toDir resolve to different trees", () => {
    const chapter: ChapterConfig = { id: "c", title: "c", fromDir: "start", toDir: "goal" };
    expect(chapterFromToShareSnapshot(source, chapter)).toBe(false);
  });
});

describe("snapshotsHaveAnyChange", () => {
  test("is false when from and to are the same on-disk directory", async () => {
    const root = await tempDir("lbd-same-snap-");
    await writeFile(path.join(root, "a.ts"), "x\n", "utf8");
    expect(await snapshotsHaveAnyChange(root, root)).toBe(false);
  });

  test("is true when the two file lists differ, without needing a content mismatch", async () => {
    const fromRoot = await tempDir("lbd-list-from-");
    const toRoot = await tempDir("lbd-list-to-");
    await writeFile(path.join(fromRoot, "a.ts"), "same\n", "utf8");
    await writeFile(path.join(toRoot, "a.ts"), "same\n", "utf8");
    await writeFile(path.join(toRoot, "b.ts"), "new\n", "utf8");
    expect(await snapshotsHaveAnyChange(fromRoot, toRoot)).toBe(true);
  });

  test("is true on the first content mismatch among otherwise identical lists", async () => {
    const fromRoot = await tempDir("lbd-content-from-");
    const toRoot = await tempDir("lbd-content-to-");
    await writeFile(path.join(fromRoot, "a.ts"), "old\n", "utf8");
    await writeFile(path.join(toRoot, "a.ts"), "new\n", "utf8");
    await writeFile(path.join(fromRoot, "b.ts"), "same\n", "utf8");
    await writeFile(path.join(toRoot, "b.ts"), "same\n", "utf8");
    expect(await snapshotsHaveAnyChange(fromRoot, toRoot)).toBe(true);
  });

  test("is false when every discovered file matches", async () => {
    const fromRoot = await tempDir("lbd-match-from-");
    const toRoot = await tempDir("lbd-match-to-");
    await mkdir(path.join(fromRoot, "src"), { recursive: true });
    await mkdir(path.join(toRoot, "src"), { recursive: true });
    await writeFile(path.join(fromRoot, "src", "a.ts"), "z\n", "utf8");
    await writeFile(path.join(toRoot, "src", "a.ts"), "z\n", "utf8");
    expect(await snapshotsHaveAnyChange(fromRoot, toRoot)).toBe(false);
  });

  test("is true when an entryFile exists on only one side", async () => {
    const fromRoot = await tempDir("lbd-entry-from-");
    const toRoot = await tempDir("lbd-entry-to-");
    await writeFile(path.join(fromRoot, "gone.ts"), "x\n", "utf8");
    await writeFile(path.join(toRoot, "keep.ts"), "y\n", "utf8");
    expect(await snapshotsHaveAnyChange(fromRoot, toRoot, ["gone.ts", "keep.ts"])).toBe(true);
  });
});
