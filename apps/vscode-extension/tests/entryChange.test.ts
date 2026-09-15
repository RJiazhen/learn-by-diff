import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { GitClient } from "../src/git/client.ts";
import { classifyEntryChange, listChangedFilesInSnapshots } from "../src/workspace/entryChange.ts";

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
