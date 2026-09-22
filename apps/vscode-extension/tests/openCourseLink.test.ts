import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { GitClient } from "../src/git/client.ts";
import { formatOpenCourseDeepLinks } from "../src/uri/formatOpenCourseLink.ts";
import { describeCourseOrigin, readCourseOrigin } from "../src/workspace/courseOrigin.ts";
import { createLearningWorkspace } from "../src/workspace/creator.ts";
import {
  collectOpenCourseLinkSources,
  githubOpenCourseUrl,
  githubOwnerRepo,
  gitOpenCourseUrl,
} from "../src/workspace/openCourseLink.ts";

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

describe("formatOpenCourseDeepLinks", () => {
  test("encodes vscode and cursor open links", () => {
    const text = formatOpenCourseDeepLinks("https://github.com/org/course.git");
    expect(text).toBe(
      [
        "vscode://RuanJiazhen.learn-by-diff/open?url=https%3A%2F%2Fgithub.com%2Forg%2Fcourse.git",
        "cursor://RuanJiazhen.learn-by-diff/open?url=https%3A%2F%2Fgithub.com%2Forg%2Fcourse.git",
      ].join("\n"),
    );
  });
});

describe("githubOwnerRepo", () => {
  test("parses https, ssh, and git@ GitHub clone URLs", () => {
    expect(githubOwnerRepo("https://github.com/org/repo.git")).toEqual({
      owner: "org",
      repo: "repo",
    });
    expect(githubOwnerRepo("git@github.com:org/repo.git")).toEqual({ owner: "org", repo: "repo" });
    expect(githubOwnerRepo("ssh://git@github.com/org/repo.git")).toEqual({
      owner: "org",
      repo: "repo",
    });
    expect(githubOwnerRepo("https://gitlab.com/org/repo.git")).toBeUndefined();
  });
});

describe("gitOpenCourseUrl / githubOpenCourseUrl", () => {
  test("appends #course.yml path and builds a blob URL", () => {
    const origin = {
      input: "https://github.com/org/course.git",
      gitUrl: "https://github.com/org/course.git",
      configRelPath: ".course-config/course.yml",
      githubRef: "main",
    };
    expect(gitOpenCourseUrl(origin)).toBe(
      "https://github.com/org/course.git#.course-config/course.yml",
    );
    expect(githubOpenCourseUrl(origin)).toBe(
      "https://github.com/org/course/blob/main/.course-config/course.yml",
    );
  });

  test("prefers a pasted GitHub file URL", () => {
    expect(
      githubOpenCourseUrl({
        input: "https://github.com/org/course/blob/dev/course.yml",
        gitUrl: "https://github.com/org/course.git",
        configRelPath: "course.yml",
        githubRef: "dev",
        githubFileUrl: "https://github.com/org/course/blob/dev/course.yml",
      }),
    ).toBe("https://github.com/org/course/blob/dev/course.yml");
  });
});

describe("describeCourseOrigin / collectOpenCourseLinkSources", () => {
  test("records a local course.yml and git remotes for copy-link sources", async () => {
    const root = await tempDir("lbd-origin-git-");
    await git.run(["init"], { cwd: root });
    await git.run(["checkout", "-B", "main"], { cwd: root });
    await git.run(["remote", "add", "origin", "https://github.com/org/demo.git"], { cwd: root });
    const configDir = path.join(root, ".course-config");
    await mkdir(path.join(configDir, "start"), { recursive: true });
    await mkdir(path.join(configDir, "done"), { recursive: true });
    await mkdir(path.join(configDir, "chapters"), { recursive: true });
    await writeFile(path.join(configDir, "start", "a.ts"), "export const a = 1;\n", "utf8");
    await writeFile(path.join(configDir, "done", "a.ts"), "export const a = 2;\n", "utf8");
    const courseYml = path.join(configDir, "course.yml");
    await writeFile(
      courseYml,
      [
        "id: origin-demo",
        "title: Origin",
        "source:",
        "  repository: .course-config",
        "",
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      path.join(configDir, "chapters", "001.yml"),
      ["id: one", "title: One", "fromDir: start", "toDir: done", ""].join("\n"),
      "utf8",
    );

    const created = await createLearningWorkspace({
      courseRepoUrl: courseYml,
      parentDir: await tempDir("lbd-origin-parent-"),
      git,
    });

    const origin = await readCourseOrigin(created.learningRoot);
    expect(origin?.localCourseYml).toBe(courseYml);
    expect(origin?.gitUrl).toBe("https://github.com/org/demo.git");
    expect(origin?.configRelPath).toBe(".course-config/course.yml");

    const sources = await collectOpenCourseLinkSources(git, created.learningRoot);
    expect(sources.map((source) => source.kind)).toEqual(["local", "git", "github"]);
    expect(sources[0]?.url).toBe(courseYml);
    expect(sources[1]?.url).toBe("https://github.com/org/demo.git#.course-config/course.yml");
    expect(sources[2]?.url).toBe("https://github.com/org/demo/blob/main/.course-config/course.yml");

    const gitignore = await readFile(path.join(created.learningRoot, ".gitignore"), "utf8");
    expect(gitignore).toContain(".learn/origin.json");
  });

  test("describes a GitHub file URL origin", async () => {
    const origin = await describeCourseOrigin(
      git,
      "https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.yml",
      "/tmp/unused",
    );
    expect(origin.gitUrl).toBe("https://github.com/RJiazhen/learn-by-diff.git");
    expect(origin.configRelPath).toBe("examples/demo-course/.course-config/course.yml");
    expect(origin.githubRef).toBe("main");
    expect(origin.githubFileUrl).toContain("blob/main/");
  });
});
