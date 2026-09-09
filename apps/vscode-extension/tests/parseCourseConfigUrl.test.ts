import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { GitClient, type GitCloneOptions } from "../src/git/client.ts";
import { resolveCourseConfigDir } from "../src/workspace/creator.ts";
import { githubCloneBranch, parseCourseConfigUrl } from "../src/workspace/parseCourseConfigUrl.ts";

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

const nestedRel = "examples/demo-course/.course-config/course.yml";
const demoBlob =
  "https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.yml";
const expectedClone = "https://github.com/RJiazhen/learn-by-diff.git";
const expectedFile = {
  kind: "githubFile",
  cloneUrl: expectedClone,
  ref: "main",
  configRelPath: nestedRel,
} as const;

describe("parseCourseConfigUrl", () => {
  test("parses GitHub blob URLs including trailing slash and ?plain=1", () => {
    expect(parseCourseConfigUrl(demoBlob)).toEqual(expectedFile);
    expect(parseCourseConfigUrl(`${demoBlob}/`)).toEqual(expectedFile);
    expect(parseCourseConfigUrl(`${demoBlob}?plain=1`)).toEqual(expectedFile);
    expect(parseCourseConfigUrl(`${demoBlob}#L1`)).toEqual(expectedFile);
    expect(
      parseCourseConfigUrl(
        "https://www.github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.yml",
      ),
    ).toEqual(expectedFile);
  });

  test("parses github.com raw URLs", () => {
    expect(
      parseCourseConfigUrl(
        "https://github.com/RJiazhen/learn-by-diff/raw/main/examples/demo-course/.course-config/course.yml",
      ),
    ).toEqual(expectedFile);
  });

  test("parses raw.githubusercontent.com including refs/heads", () => {
    expect(
      parseCourseConfigUrl(
        "https://raw.githubusercontent.com/RJiazhen/learn-by-diff/main/examples/demo-course/.course-config/course.yml",
      ),
    ).toEqual(expectedFile);
    expect(
      parseCourseConfigUrl(
        "https://raw.githubusercontent.com/RJiazhen/learn-by-diff/refs/heads/main/examples/demo-course/.course-config/course.yml",
      ),
    ).toEqual({
      ...expectedFile,
      ref: "refs/heads/main",
    });
    expect(
      parseCourseConfigUrl(
        "https://raw.githubusercontent.com/RJiazhen/learn-by-diff/refs/tags/v0.1.0/examples/demo-course/.course-config/course.yml",
      ),
    ).toEqual({
      ...expectedFile,
      ref: "refs/tags/v0.1.0",
    });
  });

  test("keeps plain git repository URLs", () => {
    expect(parseCourseConfigUrl("https://github.com/org/course.git")).toEqual({
      kind: "gitRepo",
      url: "https://github.com/org/course.git",
    });
    expect(parseCourseConfigUrl("https://github.com/org/course")).toEqual({
      kind: "gitRepo",
      url: "https://github.com/org/course",
    });
    expect(parseCourseConfigUrl("git@github.com:org/course.git")).toEqual({
      kind: "gitRepo",
      url: "git@github.com:org/course.git",
    });
  });

  test("parses git URL # relative course.yml path", () => {
    expect(
      parseCourseConfigUrl(`https://github.com/RJiazhen/learn-by-diff.git#${nestedRel}`),
    ).toEqual({
      kind: "gitRepo",
      url: "https://github.com/RJiazhen/learn-by-diff.git",
      configRelPath: nestedRel,
    });
    expect(
      parseCourseConfigUrl(
        "https://github.com/RJiazhen/learn-by-diff#examples/demo-course/.course-config/course.yml",
      ),
    ).toEqual({
      kind: "gitRepo",
      url: "https://github.com/RJiazhen/learn-by-diff",
      configRelPath: nestedRel,
    });
    expect(parseCourseConfigUrl(`git@github.com:RJiazhen/learn-by-diff.git#${nestedRel}`)).toEqual({
      kind: "gitRepo",
      url: "git@github.com:RJiazhen/learn-by-diff.git",
      configRelPath: nestedRel,
    });
    expect(parseCourseConfigUrl("https://github.com/org/course.git#course.yml")).toEqual({
      kind: "gitRepo",
      url: "https://github.com/org/course.git",
      configRelPath: "course.yml",
    });
  });

  test("rejects git URL # fragments that are not course.yml", () => {
    expect(() =>
      parseCourseConfigUrl("https://github.com/org/course.git#examples/README.md"),
    ).toThrow(/# fragment must be a course\.yml path/);
  });

  test("ignores local paths", () => {
    expect(parseCourseConfigUrl("/tmp/course.yml")).toBeUndefined();
    expect(parseCourseConfigUrl("examples/demo-course/.course-config/course.yml")).toBeUndefined();
  });

  test("rejects GitHub file URLs that are not course.yml", () => {
    expect(() =>
      parseCourseConfigUrl(
        "https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/README.md",
      ),
    ).toThrow(/must point at course\.yml/);
    expect(() =>
      parseCourseConfigUrl(
        "https://raw.githubusercontent.com/RJiazhen/learn-by-diff/main/README.md",
      ),
    ).toThrow(/must point at course\.yml/);
  });
});

describe("githubCloneBranch", () => {
  test("uses branch and tag names, not commit SHAs", () => {
    expect(githubCloneBranch("main")).toBe("main");
    expect(githubCloneBranch("refs/heads/main")).toBe("main");
    expect(githubCloneBranch("refs/tags/v0.1.0")).toBe("v0.1.0");
    expect(githubCloneBranch("abcdef0")).toBeUndefined();
    expect(githubCloneBranch("0123456789abcdef0123456789abcdef01234567")).toBeUndefined();
  });
});

/**
 * Git client that records clone calls and copies a fixture tree instead of hitting the network.
 */
class RecordingGitClient extends GitClient {
  cloneCalls: Array<{ url: string; dest: string; options: GitCloneOptions }> = [];

  /**
   * @param tree - Directory copied into each clone destination
   */
  constructor(private readonly tree: string) {
    super();
  }

  /**
   * Records clone arguments and copies {@link tree} into `dest`.
   *
   * @param url - Clone URL the real client would receive
   * @param dest - Destination directory
   * @param options - Shallow clone and branch options
   */
  override async clone(url: string, dest: string, options: GitCloneOptions = {}): Promise<void> {
    this.cloneCalls.push({ url, dest, options });
    await mkdir(path.dirname(dest), { recursive: true });
    await cp(this.tree, dest, { recursive: true });
  }
}

/**
 * Writes a nested demo `course.yml` under a fake clone tree.
 */
async function writeNestedCourseTree(root: string): Promise<void> {
  const file = path.join(root, ...nestedRel.split("/"));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, "title: Demo\n", "utf8");
}

describe("resolveCourseConfigDir GitHub file URLs", () => {
  test("clones the git repo and opens the nested course.yml path", async () => {
    const tree = await tempDir("lbd-gh-tree-");
    await writeNestedCourseTree(tree);
    const git = new RecordingGitClient(tree);
    const source = await resolveCourseConfigDir(git, `${demoBlob}?plain=1`);
    try {
      expect(git.cloneCalls).toEqual([
        {
          url: expectedClone,
          dest: git.cloneCalls[0]?.dest,
          options: { depth: 1, branch: "main" },
        },
      ]);
      expect(path.basename(source.configDir)).toBe(".course-config");
      expect(await readFile(path.join(source.configDir, "course.yml"), "utf8")).toBe(
        "title: Demo\n",
      );
    } finally {
      await source.cleanup();
    }
  });

  test("uses refs/heads from raw URLs as --branch main", async () => {
    const tree = await tempDir("lbd-gh-raw-");
    await writeNestedCourseTree(tree);
    const git = new RecordingGitClient(tree);
    const source = await resolveCourseConfigDir(
      git,
      "https://raw.githubusercontent.com/RJiazhen/learn-by-diff/refs/heads/main/examples/demo-course/.course-config/course.yml",
    );
    try {
      expect(git.cloneCalls[0]).toMatchObject({
        url: expectedClone,
        options: { depth: 1, branch: "main" },
      });
    } finally {
      await source.cleanup();
    }
  });

  test("throws when the nested course.yml is missing after clone", async () => {
    const tree = await tempDir("lbd-gh-empty-");
    const git = new RecordingGitClient(tree);
    await expect(resolveCourseConfigDir(git, demoBlob)).rejects.toThrow(
      "course.yml not found in cloned repository",
    );
    expect(git.cloneCalls[0]?.url).toBe(expectedClone);
  });

  test("clones a git URL and opens the # course.yml path", async () => {
    const tree = await tempDir("lbd-git-hash-");
    await writeNestedCourseTree(tree);
    const git = new RecordingGitClient(tree);
    const source = await resolveCourseConfigDir(
      git,
      `https://github.com/RJiazhen/learn-by-diff.git#${nestedRel}`,
    );
    try {
      expect(git.cloneCalls[0]).toMatchObject({
        url: "https://github.com/RJiazhen/learn-by-diff.git",
        options: {},
      });
      expect(path.basename(source.configDir)).toBe(".course-config");
    } finally {
      await source.cleanup();
    }
  });
});
