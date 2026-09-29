/**
 * Unit tests for skills/generate-course-config/scripts/detect-chapter-dirs.mjs,
 * plus a demo-source fixture.
 */
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  buildChapters,
  changedFilesBetween,
  detectCourse,
  isStartName,
  scoreName,
  similarity,
} from "../../skills/generate-course-config/scripts/detect-chapter-dirs.mjs";

const demoSource = path.resolve(
  fileURLToPath(new URL("../../../examples/demo-source", import.meta.url)),
);

/** Temp directories created by a test; drained in {@link removeTemps}. */
const temps = [];

/**
 * Creates a unique temp directory and schedules it for cleanup.
 *
 * @param {string} prefix - mkdtemp prefix
 */
async function tempDir(prefix) {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

/**
 * Deletes temp directories created during the last test.
 */
async function removeTemps() {
  await Promise.all(temps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
}

afterEach(removeTemps);

describe("scoreName", () => {
  test("scores start-like and demo snapshot names, and skips monorepo noise", () => {
    expect(scoreName("start")).toBe(50);
    expect(scoreName("skeleton")).toBe(25);
    expect(scoreName("particles")).toBe(25);
    expect(scoreName("apps")).toBe(0);
    expect(scoreName("node_modules")).toBe(0);
    expect(scoreName("random-folder")).toBe(0);
  });
});

describe("isStartName", () => {
  test("matches explicit start snapshot names only", () => {
    expect(isStartName("start")).toBe(true);
    expect(isStartName("Baseline")).toBe(true);
    expect(isStartName("skeleton")).toBe(false);
  });
});

describe("similarity", () => {
  test("returns Jaccard overlap of path sets", () => {
    expect(similarity(["a.ts", "b.ts"], ["a.ts", "b.ts"])).toBe(1);
    expect(similarity(["a.ts"], ["b.ts"])).toBe(0);
    expect(similarity(["a.ts", "b.ts"], ["b.ts", "c.ts"])).toBe(1 / 3);
    expect(similarity([], [])).toBe(0);
  });
});

describe("buildChapters", () => {
  test("maps consecutive snapshots to fromDir/toDir chapters", () => {
    expect(buildChapters(["start", "skeleton", "particles"])).toEqual([
      { id: "skeleton", title: "Skeleton", fromDir: "start", toDir: "skeleton" },
      { id: "particles", title: "Particles", fromDir: "skeleton", toDir: "particles" },
    ]);
  });

  test("strips numeric prefixes from the toDir basename", () => {
    expect(buildChapters(["00-start", "01-hello"])).toEqual([
      { id: "hello", title: "Hello", fromDir: "00-start", toDir: "01-hello" },
    ]);
  });
});

describe("changedFilesBetween", () => {
  test("classifies added, modified, and deleted files; ignores identical files", async () => {
    const root = await tempDir("lbd-detect-change-");
    await mkdir(path.join(root, "from", "src"), { recursive: true });
    await mkdir(path.join(root, "to", "src"), { recursive: true });
    await writeFile(path.join(root, "from", "src", "keep.ts"), "a\n", "utf8");
    await writeFile(path.join(root, "to", "src", "keep.ts"), "b\n", "utf8");
    await writeFile(path.join(root, "from", "src", "gone.ts"), "x\n", "utf8");
    await writeFile(path.join(root, "to", "src", "new.ts"), "y\n", "utf8");
    await writeFile(path.join(root, "from", "src", "same.ts"), "z\n", "utf8");
    await writeFile(path.join(root, "to", "src", "same.ts"), "z\n", "utf8");

    expect(await changedFilesBetween(root, "from", "to")).toEqual([
      { path: "src/gone.ts", kind: "D" },
      { path: "src/keep.ts", kind: "M" },
      { path: "src/new.ts", kind: "U" },
    ]);
  });

  test("treats an empty fromDir as an empty tree (all toDir files are U)", async () => {
    const root = await tempDir("lbd-detect-empty-");
    await mkdir(path.join(root, "to"), { recursive: true });
    await writeFile(path.join(root, "to", "a.ts"), "a\n", "utf8");

    expect(await changedFilesBetween(root, "", "to")).toEqual([{ path: "a.ts", kind: "U" }]);
    expect(await changedFilesBetween(root, "to", "")).toEqual([{ path: "a.ts", kind: "D" }]);
  });
});

describe("detectCourse examples/demo-source", () => {
  test("orders demo snapshots and fills U/M/D changedFiles", async () => {
    const result = await detectCourse(demoSource);
    expect(result).toEqual({
      ok: true,
      root: demoSource,
      courseId: "demo-source",
      snapshots: ["start", "skeleton", "particles", "follow", "glow"],
      chapters: [
        {
          id: "skeleton",
          title: "Skeleton",
          fromDir: "start",
          toDir: "skeleton",
          changedFiles: [
            { path: "README.md", kind: "U" },
            { path: "css/styles.css", kind: "M" },
            { path: "index.html", kind: "M" },
            { path: "src/main.js", kind: "M" },
            { path: "src/scene/canvas.js", kind: "U" },
            { path: "src/scene/loop.js", kind: "U" },
          ],
        },
        {
          id: "particles",
          title: "Particles",
          fromDir: "skeleton",
          toDir: "particles",
          changedFiles: [
            { path: "README.md", kind: "M" },
            { path: "src/main.js", kind: "M" },
            { path: "src/particle/field.js", kind: "U" },
            { path: "src/particle/particle.js", kind: "U" },
          ],
        },
        {
          id: "follow",
          title: "Follow",
          fromDir: "particles",
          toDir: "follow",
          changedFiles: [
            { path: "README.md", kind: "M" },
            { path: "src/main.js", kind: "M" },
            { path: "src/particle/particle.js", kind: "M" },
            { path: "src/pointer/pointer.js", kind: "U" },
          ],
        },
        {
          id: "glow",
          title: "Glow",
          fromDir: "follow",
          toDir: "glow",
          changedFiles: [
            { path: "README.md", kind: "D" },
            { path: "css/styles.css", kind: "M" },
            { path: "docs.md", kind: "U" },
            { path: "docs.pdf", kind: "U" },
            { path: "src/particle/field.js", kind: "M" },
            { path: "src/particle/particle.js", kind: "M" },
            { path: "src/scene/canvas.js", kind: "M" },
          ],
        },
      ],
    });
  });

  test("honors forced dirs without re-detecting siblings", async () => {
    const result = await detectCourse(demoSource, ["start", "glow"]);
    expect(result.ok).toBe(true);
    expect(result.snapshots).toEqual(["start", "glow"]);
    expect(result.chapters?.[0]?.id).toBe("glow");
    expect(result.chapters?.[0]?.changedFiles?.some((file) => file.kind === "U")).toBe(true);
  });
});
