import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { GitClient } from "../src/git/client.ts";
import { hasStudentEditsSinceChapterStart } from "../src/workspace/studentTree.ts";

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

describe("hasStudentEditsSinceChapterStart", () => {
  test("returns false when workspace matches the chapter start tree", async () => {
    const store = await tempDir("lbd-match-store-");
    const workspace = await tempDir("lbd-match-ws-");
    await mkdir(path.join(store, "start", "src"), { recursive: true });
    await writeFile(path.join(store, "start", "src", "index.ts"), "export const v = 1;\n", "utf8");
    await mkdir(path.join(workspace, "src"), { recursive: true });
    await writeFile(path.join(workspace, "src", "index.ts"), "export const v = 1;\n", "utf8");
    await writeFile(path.join(workspace, ".gitignore"), "node_modules/\n", "utf8");

    expect(await hasStudentEditsSinceChapterStart(git, workspace, store, "start")).toBe(false);
  });

  test("returns true when a student file differs from the chapter start", async () => {
    const store = await tempDir("lbd-edit-store-");
    const workspace = await tempDir("lbd-edit-ws-");
    await mkdir(path.join(store, "start", "src"), { recursive: true });
    await writeFile(path.join(store, "start", "src", "index.ts"), "export const v = 1;\n", "utf8");
    await mkdir(path.join(workspace, "src"), { recursive: true });
    await writeFile(path.join(workspace, "src", "index.ts"), "export const v = 2;\n", "utf8");

    expect(await hasStudentEditsSinceChapterStart(git, workspace, store, "start")).toBe(true);
  });
});
