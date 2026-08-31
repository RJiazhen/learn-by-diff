import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { GitClient } from "../src/git/client.ts";

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
 * Initializes a git repo with one commit on `branch`.
 */
async function seedRepo(dir: string, files: Record<string, string>, branch: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await git.run(["init"], { cwd: dir });
  await git.run(["checkout", "-b", branch], { cwd: dir });
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
      "seed",
    ],
    { cwd: dir },
  );
}

describe("GitClient", () => {
  test("archives a subdirectory from a mirror HEAD", async () => {
    const source = await tempDir("lbd-src-");
    await seedRepo(
      source,
      {
        "start/a.ts": "export const a = 1;\n",
        "done/a.ts": "export const a = 2;\n",
      },
      "main",
    );

    const mirror = path.join(await tempDir("lbd-mirror-"), "source.git");
    await git.cloneMirror(source, mirror);

    const out = await tempDir("lbd-out-");
    await git.archiveSubtree(mirror, "start", out);
    expect(await readFile(path.join(out, "a.ts"), "utf8")).toBe("export const a = 1;\n");
  });
});
