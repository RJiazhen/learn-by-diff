/**
 * Unit tests for skills/generate-course-config/scripts/detect-chapter-dirs.mjs,
 * plus a demo-source fixture.
 */
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vite-plus/test";
import {
  DEFAULT_MAX_DEPTH,
  RESULT_FILE_NAME,
  buildChapters,
  changedFilesBetween,
  detectCourse,
  fillChangedFiles,
  formatChangedFilesJsonc,
  formatError,
  formatFailedResults,
  formatNewChapterJsonc,
  isStartName,
  parseMaxDepth,
  readChapterSnapshotFields,
  scoreName,
  similarity,
  upsertChangedFilesJsonc,
  writeChapterConfigs,
} from "../../skills/generate-course-config/scripts/detect-chapter-dirs.mjs";

const demoSource = path.resolve(
  fileURLToPath(new URL("../../../examples/demo-source", import.meta.url)),
);
const detectorScript = path.resolve(
  fileURLToPath(
    new URL(
      "../../../skills/generate-course-config/scripts/detect-chapter-dirs.mjs",
      import.meta.url,
    ),
  ),
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

/**
 * Writes a minimal chapter JSONC file under `configDir/chapters`.
 *
 * @param {string} configDir
 * @param {string} fileName
 * @param {{ id?: string, fromDir: string, toDir: string, docs?: string }} fields
 */
async function writeBasicChapter(configDir, fileName, fields) {
  const chaptersDir = path.join(configDir, "chapters");
  await mkdir(chaptersDir, { recursive: true });
  const doc = {
    ...(fields.id !== undefined ? { id: fields.id } : {}),
    fromDir: fields.fromDir,
    toDir: fields.toDir,
    ...(fields.docs !== undefined ? { docs: fields.docs } : {}),
  };
  await writeFile(path.join(chaptersDir, fileName), `${JSON.stringify(doc, null, 2)}\n`, "utf8");
}

/**
 * Spawns `detect-chapter-dirs.mjs` and collects stdout, stderr, and exit code.
 *
 * @param {string[]} args - CLI arguments after the script path
 */
function runDetectorCli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [detectorScript, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    /** Appends a stdout chunk from the detector CLI. */
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    /** Appends a stderr chunk from the detector CLI. */
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    /**
     * Resolves with the process result once the CLI exits.
     *
     * @param {number | null} code - Process exit code
     */
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

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

  test("honors maxDepth so files deeper than the limit are omitted", async () => {
    const root = await tempDir("lbd-detect-depth-");
    await mkdir(path.join(root, "from", "src", "nested"), { recursive: true });
    await mkdir(path.join(root, "to", "src", "nested"), { recursive: true });
    await writeFile(path.join(root, "from", "readme.md"), "a\n", "utf8");
    await writeFile(path.join(root, "to", "readme.md"), "b\n", "utf8");
    await writeFile(path.join(root, "from", "src", "nested", "deep.ts"), "x\n", "utf8");
    await writeFile(path.join(root, "to", "src", "nested", "deep.ts"), "y\n", "utf8");

    expect(await changedFilesBetween(root, "from", "to", 0)).toEqual([
      { path: "readme.md", kind: "M" },
    ]);
    expect(await changedFilesBetween(root, "from", "to", 2)).toEqual([
      { path: "readme.md", kind: "M" },
      { path: "src/nested/deep.ts", kind: "M" },
    ]);
  });
});

describe("parseMaxDepth", () => {
  test("accepts non-negative integers and rejects junk", () => {
    expect(parseMaxDepth("0")).toBe(0);
    expect(parseMaxDepth("8")).toBe(8);
    expect(parseMaxDepth(" 4 ")).toBe(4);
    expect(parseMaxDepth("")).toBeUndefined();
    expect(parseMaxDepth("-1")).toBeUndefined();
    expect(parseMaxDepth("4.5")).toBeUndefined();
    expect(DEFAULT_MAX_DEPTH).toBe(6);
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

describe("chapter JSONC write", () => {
  test("readChapterSnapshotFields reads fromDir/toDir and id from the filename", () => {
    expect(
      readChapterSnapshotFields(
        '{ "fromDir": "start", "toDir": "glow", "docs": "README.md" }\n',
        "001-glow.jsonc",
      ),
    ).toEqual({
      id: "glow",
      fromDir: "start",
      toDir: "glow",
      file: "001-glow.jsonc",
    });
    expect(
      readChapterSnapshotFields(
        '{ "id": "custom", "fromDir": "", "toDir": "hello" }\n',
        "009-x.jsonc",
      ),
    ).toEqual({
      id: "custom",
      fromDir: "",
      toDir: "hello",
      file: "009-x.jsonc",
    });
  });

  test("formatFailedResults lists only failed chapters", () => {
    const text = formatFailedResults({
      ok: false,
      wrote: 1,
      failed: 1,
      chapters: [
        {
          ok: true,
          id: "skeleton",
          fromDir: "start",
          toDir: "skeleton",
          file: "001-skeleton.jsonc",
          changes: 6,
        },
        {
          ok: false,
          id: "broken",
          fromDir: "skeleton",
          toDir: "nope",
          error: "snapshot not found: nope",
        },
      ],
    });
    expect(JSON.parse(text)).toEqual([
      {
        id: "broken",
        fromDir: "skeleton",
        toDir: "nope",
        error: "snapshot not found: nope",
      },
    ]);
  });

  test("formatFailedResults uses reason when no chapter records exist", () => {
    expect(
      JSON.parse(
        formatFailedResults({
          ok: false,
          wrote: 0,
          failed: 0,
          reason: "root not found",
          chapters: [],
        }),
      ),
    ).toEqual([{ error: "root not found" }]);
  });

  test("formatChangedFilesJsonc emits [] or a list", () => {
    expect(formatChangedFilesJsonc([])).toBe("[]");
    expect(JSON.parse(formatChangedFilesJsonc([{ path: "src/a.ts", kind: "M" }]))).toEqual([
      { path: "src/a.ts", kind: "M" },
    ]);
  });

  test("upsertChangedFilesJsonc replaces changedFiles and keeps comments", () => {
    const existing = [
      "{",
      "  // keep",
      '  "id": "skeleton",',
      '  "fromDir": "start",',
      '  "toDir": "skeleton",',
      '  "changedFiles": [{ "path": "old.ts", "kind": "U" }],',
      '  "docs": "README.md"',
      "}",
      "",
    ].join("\n");
    const next = upsertChangedFilesJsonc(existing, [{ path: "src/a.ts", kind: "M" }]);
    expect(next).toContain("// keep");
    expect(next).toContain('"docs": "README.md"');
    expect(next).toContain('"path": "src/a.ts"');
    expect(next).not.toContain("old.ts");
  });

  test("writeChapterConfigs creates files and updates changedFiles in place", async () => {
    const configDir = await tempDir("lbd-detect-yaml-");
    await writeChapterConfigs(configDir, [
      {
        id: "skeleton",
        title: "Skeleton",
        fromDir: "start",
        toDir: "skeleton",
        changedFiles: [{ path: "a.ts", kind: "U" }],
      },
    ]);
    const filePath = path.join(configDir, "chapters", "001-skeleton.jsonc");
    expect(await readFile(filePath, "utf8")).toBe(
      formatNewChapterJsonc({
        id: "skeleton",
        title: "Skeleton",
        fromDir: "start",
        toDir: "skeleton",
        changedFiles: [{ path: "a.ts", kind: "U" }],
      }),
    );
    await writeFile(
      filePath,
      `${JSON.stringify(
        {
          id: "skeleton",
          title: "Keep me",
          fromDir: "start",
          toDir: "skeleton",
          docs: "README.md",
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    await writeChapterConfigs(configDir, [
      {
        id: "skeleton",
        title: "Skeleton",
        fromDir: "start",
        toDir: "skeleton",
        changedFiles: [{ path: "b.ts", kind: "M" }],
      },
    ]);
    const updated = await readFile(filePath, "utf8");
    expect(updated).toContain('"title": "Keep me"');
    expect(updated).toContain('"docs": "README.md"');
    expect(updated).toContain('"path": "b.ts"');
    expect(updated).not.toContain('"path": "a.ts"');
  });

  test("fillChangedFiles records one chapter error and still fills the rest", async () => {
    const root = await tempDir("lbd-detect-fill-");
    await mkdir(path.join(root, "from"));
    await mkdir(path.join(root, "mid"));
    await mkdir(path.join(root, "to"));
    const chapters = [
      { id: "mid", title: "Mid", fromDir: "from", toDir: "mid" },
      { id: "to", title: "To", fromDir: "mid", toDir: "to" },
    ];
    let calls = 0;
    /**
     * Throws on the first chapter compare, then returns one modified file.
     *
     * @param {string} _root
     * @param {string} _fromDir
     * @param {string} _toDir
     */
    async function compare(_root, _fromDir, _toDir) {
      calls += 1;
      if (calls === 1) {
        throw new Error("boom");
      }
      return [{ path: "x.ts", kind: "M" }];
    }
    await fillChangedFiles(root, chapters, DEFAULT_MAX_DEPTH, compare);
    expect(formatError(new Error("boom"))).toBe("boom");
    expect(chapters[0]?.error).toBe("boom");
    expect(chapters[0]?.changedFiles).toBeUndefined();
    expect(chapters[1]?.changedFiles).toEqual([{ path: "x.ts", kind: "M" }]);
    expect(chapters[1]?.error).toBeUndefined();
  });

  test("writeChapterConfigs keeps going when one JSONC path cannot be written", async () => {
    const configDir = await tempDir("lbd-detect-write-err-");
    const chaptersDir = path.join(configDir, "chapters");
    await mkdir(path.join(chaptersDir, "001-skeleton.jsonc"), { recursive: true });
    const results = await writeChapterConfigs(configDir, [
      {
        id: "skeleton",
        title: "Skeleton",
        fromDir: "start",
        toDir: "skeleton",
        changedFiles: [{ path: "a.ts", kind: "U" }],
      },
      {
        id: "particles",
        title: "Particles",
        fromDir: "skeleton",
        toDir: "particles",
        changedFiles: [{ path: "b.ts", kind: "M" }],
      },
    ]);
    expect(results[0]?.ok).toBe(false);
    expect(results[0]?.error).toBeDefined();
    expect(results[1]).toEqual({
      ok: true,
      id: "particles",
      fromDir: "skeleton",
      toDir: "particles",
      file: "002-particles.jsonc",
      changes: 1,
    });
    expect(await readFile(path.join(chaptersDir, "002-particles.jsonc"), "utf8")).toContain(
      '"path": "b.ts"',
    );
  });

  test("CLI fills changedFiles on existing JSONC and prints a compact stdout summary", async () => {
    const configDir = await tempDir("lbd-detect-cli-");
    await writeBasicChapter(configDir, "001-skeleton.jsonc", {
      id: "skeleton",
      fromDir: "start",
      toDir: "skeleton",
    });
    const { code, stdout } = await runDetectorCli(["--out", configDir, demoSource]);
    expect(code).toBe(0);
    const summary = JSON.parse(stdout);
    expect(summary).toEqual({
      ok: true,
      wrote: 1,
      failed: 0,
    });
    expect(stdout).not.toContain("src/scene/canvas.js");
    await expect(readFile(path.join(configDir, RESULT_FILE_NAME), "utf8")).rejects.toThrow();
    const chapter = await readFile(path.join(configDir, "chapters", "001-skeleton.jsonc"), "utf8");
    expect(chapter).toContain('"path": "src/scene/canvas.js"');
    expect(chapter).toContain('"kind": "U"');
  });

  test("CLI fills a non-consecutive fromDir/toDir pair", async () => {
    const configDir = await tempDir("lbd-detect-jump-");
    await writeBasicChapter(configDir, "001-glow.jsonc", {
      fromDir: "start",
      toDir: "glow",
    });
    const { code, stdout } = await runDetectorCli(["--out", configDir, demoSource]);
    expect(code).toBe(0);
    expect(JSON.parse(stdout)).toMatchObject({ ok: true, wrote: 1, failed: 0 });
    const chapter = await readFile(path.join(configDir, "chapters", "001-glow.jsonc"), "utf8");
    expect(chapter).toContain('"path": "src/particle/particle.js"');
  });

  test("CLI continues after a bad snapshot and writes only that failure to the result file", async () => {
    const root = await tempDir("lbd-detect-partial-");
    await mkdir(path.join(root, "start"));
    await mkdir(path.join(root, "skeleton"));
    await writeFile(path.join(root, "start", "a.ts"), "a\n", "utf8");
    await writeFile(path.join(root, "skeleton", "a.ts"), "b\n", "utf8");
    const configDir = await tempDir("lbd-detect-partial-out-");
    await writeBasicChapter(configDir, "001-skeleton.jsonc", {
      fromDir: "start",
      toDir: "skeleton",
    });
    await writeBasicChapter(configDir, "002-broken.jsonc", {
      fromDir: "skeleton",
      toDir: "not-a-dir",
    });
    const { code, stdout } = await runDetectorCli(["--out", configDir, root]);
    expect(code).toBe(1);
    const summary = JSON.parse(stdout);
    expect(summary.ok).toBe(false);
    expect(summary.wrote).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.result).toBe(path.join(configDir, RESULT_FILE_NAME));
    expect(
      await readFile(path.join(configDir, "chapters", "001-skeleton.jsonc"), "utf8"),
    ).toContain('"kind": "M"');
    const report = JSON.parse(await readFile(summary.result, "utf8"));
    expect(report).toEqual([
      {
        id: "broken",
        fromDir: "skeleton",
        toDir: "not-a-dir",
        error: expect.stringContaining("snapshot not found"),
      },
    ]);
  });

  test("CLI --json prints the fill result and does not write changedFiles", async () => {
    const configDir = await tempDir("lbd-detect-json-");
    await writeBasicChapter(configDir, "001-skeleton.jsonc", {
      fromDir: "start",
      toDir: "skeleton",
    });
    const { code, stdout } = await runDetectorCli(["--json", "--out", configDir, demoSource]);
    expect(code).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.ok).toBe(true);
    expect(
      result.chapters[0].changedFiles.some((file) => file.path === "src/scene/canvas.js"),
    ).toBe(true);
    expect(
      await readFile(path.join(configDir, "chapters", "001-skeleton.jsonc"), "utf8"),
    ).not.toContain("changedFiles");
  });

  test("CLI rejects --dirs", async () => {
    const { code, stdout } = await runDetectorCli(["--dirs", "start,skeleton", "."]);
    expect(code).toBe(1);
    expect(JSON.parse(stdout).reason).toContain("--dirs was removed");
  });
});
