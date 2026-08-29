import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { GitClient } from "../src/git/client.ts";
import { classifyEntryChange } from "../src/workspace/entryChange.ts";

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
});
