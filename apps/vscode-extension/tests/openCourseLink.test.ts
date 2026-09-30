import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { GitClient } from "../src/git/client.ts";
import {
  formatOpenCourseDeepLink,
  formatOpenCourseDeepLinks,
} from "../src/uri/formatOpenCourseLink.ts";
import { describeCourseOrigin, readCourseOrigin } from "../src/workspace/courseOrigin.ts";
import { createLearningWorkspace } from "../src/workspace/creator.ts";
import {
  collectOpenCourseLinkSources,
  collectOpenCourseLinkSourcesForCourseYml,
  currentCourseOpenUrl,
  gitOpenCourseUrl,
  isWorkspaceCourseYml,
  oneClickCopyOptions,
  workspaceCourseCopyPicks,
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

describe("formatOpenCourseDeepLink", () => {
  test("encodes a single editor scheme", () => {
    expect(formatOpenCourseDeepLink("vscode", "https://github.com/org/course.git")).toBe(
      "vscode://RuanJiazhen.learn-by-diff/open?url=https%3A%2F%2Fgithub.com%2Forg%2Fcourse.git",
    );
    expect(formatOpenCourseDeepLink("cursor", "/tmp/course.jsonc")).toBe(
      "cursor://RuanJiazhen.learn-by-diff/open?url=%2Ftmp%2Fcourse.jsonc",
    );
  });
});

describe("oneClickCopyOptions / workspaceCourseCopyPicks / isWorkspaceCourseYml", () => {
  test("builds one URI per scheme and source without joining them", () => {
    const options = oneClickCopyOptions([
      { kind: "local", url: "/tmp/course.jsonc" },
      { kind: "git", url: "https://github.com/org/course.git" },
    ]);
    expect(options.map((option) => option.uri)).toEqual([
      "vscode://RuanJiazhen.learn-by-diff/open?url=https%3A%2F%2Fgithub.com%2Forg%2Fcourse.git",
      "vscode://RuanJiazhen.learn-by-diff/open?url=%2Ftmp%2Fcourse.jsonc",
      "cursor://RuanJiazhen.learn-by-diff/open?url=https%3A%2F%2Fgithub.com%2Forg%2Fcourse.git",
      "cursor://RuanJiazhen.learn-by-diff/open?url=%2Ftmp%2Fcourse.jsonc",
    ]);
  });

  test("lists local, remote, and one-click rows per available source", () => {
    expect(
      workspaceCourseCopyPicks([{ kind: "local", url: "/tmp/course.jsonc" }]).map(
        (pick) => pick.kind,
      ),
    ).toEqual(["plain-local", "one-click", "one-click"]);
    expect(
      workspaceCourseCopyPicks([
        { kind: "local", url: "/tmp/course.jsonc" },
        { kind: "git", url: "https://github.com/org/course.git" },
      ]).map((pick) =>
        pick.kind === "one-click" ? `${pick.option.scheme}:${pick.option.source.kind}` : pick.kind,
      ),
    ).toEqual([
      "plain-remote",
      "plain-local",
      "vscode:git",
      "vscode:local",
      "cursor:git",
      "cursor:local",
    ]);
  });

  test("skips .learn and node_modules course.jsonc copies", () => {
    expect(isWorkspaceCourseYml("/repo/.course-config/course.jsonc")).toBe(true);
    expect(isWorkspaceCourseYml("/repo/.learn/course/course.jsonc")).toBe(false);
    expect(isWorkspaceCourseYml("/repo/node_modules/pkg/course.jsonc")).toBe(false);
    expect(isWorkspaceCourseYml("/repo/README.md")).toBe(false);
  });
});

describe("gitOpenCourseUrl", () => {
  test("appends #course.jsonc path when the config is nested", () => {
    const origin = {
      input: "https://github.com/org/course.git",
      gitUrl: "https://github.com/org/course.git",
      configRelPath: ".course-config/course.jsonc",
      githubRef: "main",
    };
    expect(gitOpenCourseUrl(origin)).toBe(
      "https://github.com/org/course.git#.course-config/course.jsonc",
    );
  });
});

describe("describeCourseOrigin / collectOpenCourseLinkSources", () => {
  test("records a local course.jsonc and git remotes for copy-link sources", async () => {
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
    const courseYml = path.join(configDir, "course.jsonc");
    await writeFile(
      courseYml,
      `{
  "id": "origin-demo",
  "title": "Origin",
  "source": {
    "repository": "."
  }
}\n`,
      "utf8",
    );
    await writeFile(
      path.join(configDir, "chapters", "001.jsonc"),
      `{
  "id": "one",
  "title": "One",
  "fromDir": "start",
  "toDir": "done"
}\n`,
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
    expect(origin?.configRelPath).toBe(".course-config/course.jsonc");

    const sources = await collectOpenCourseLinkSources(git, created.learningRoot);
    expect(sources.map((source) => source.kind)).toEqual(["local", "git"]);
    expect(sources[0]?.url).toBe(courseYml);
    expect(sources[1]?.url).toBe("https://github.com/org/demo.git#.course-config/course.jsonc");

    expect(await currentCourseOpenUrl(git, created.learningRoot)).toBe(courseYml);

    const fromFile = await collectOpenCourseLinkSourcesForCourseYml(git, courseYml);
    expect(fromFile.map((source) => source.kind)).toEqual(["local", "git"]);
    expect(fromFile[1]?.url).toBe("https://github.com/org/demo.git#.course-config/course.jsonc");

    const gitignore = await readFile(path.join(created.learningRoot, ".gitignore"), "utf8");
    expect(gitignore).toContain(".learn/origin.json");
  });

  test("describes a GitHub file URL origin", async () => {
    const origin = await describeCourseOrigin(
      git,
      "https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.jsonc",
      "/tmp/unused",
    );
    expect(origin.gitUrl).toBe("https://github.com/RJiazhen/learn-by-diff.git");
    expect(origin.input).toBe(
      "https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.jsonc",
    );
    expect(origin.configRelPath).toBe("examples/demo-course/.course-config/course.jsonc");
    expect(origin.githubRef).toBe("main");
    expect(origin.githubFileUrl).toContain("blob/main/");
  });
});
