import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { GIT_NOT_FOUND_MESSAGE, GitError } from "./errors.ts";

const execFileAsync = promisify(execFile);

/** Result of a successful git process. */
export interface GitRunResult {
  stdout: string;
  stderr: string;
}

/**
 * Thin wrapper around the host `git` CLI. Does not keep a worktree GIT_DIR
 * pointed at a source mirror.
 */
export class GitClient {
  /**
   * @param gitBin - Executable name or path; defaults to `git` on PATH
   */
  constructor(private readonly gitBin: string = "git") {}

  /**
   * Fails fast if `git` is missing or not executable.
   */
  async ensureAvailable(): Promise<void> {
    try {
      await this.run(["--version"]);
    } catch (error) {
      if (isMissingBinary(error)) {
        throw new GitError(GIT_NOT_FOUND_MESSAGE, {
          cause: error,
        });
      }
      throw error;
    }
  }

  /**
   * Clones `url` into `dest` (creates parent directories as needed).
   */
  async clone(url: string, dest: string): Promise<void> {
    await mkdir(path.dirname(dest), { recursive: true });
    await this.run(["clone", "--", url, dest]);
  }

  /**
   * Creates a bare mirror at `dest` for archive/diff/show only.
   */
  async cloneMirror(url: string, dest: string): Promise<void> {
    await mkdir(path.dirname(dest), { recursive: true });
    await this.run(["clone", "--mirror", "--", url, dest]);
  }

  /**
   * Exports `ref` from a git directory (often a bare mirror) into `destDir`.
   *
   * @param gitDir - Absolute path to a `.git` dir or bare repo
   * @param ref - Tree-ish
   * @param destDir - Directory to extract into (created if missing)
   */
  async archive(gitDir: string, ref: string, destDir: string): Promise<void> {
    await mkdir(destDir, { recursive: true });
    const staging = await mkdtemp(path.join(tmpdir(), "learn-by-diff-archive-"));
    const tarPath = path.join(staging, "tree.tar");
    try {
      await this.run(["--git-dir", gitDir, "archive", "--format=tar", `--output=${tarPath}`, ref], {
        cwd: destDir,
      });
      await execFileAsync("tar", ["-xf", tarPath, "-C", destDir], {
        encoding: "utf8",
      });
    } catch (error) {
      throw wrapGitError(error, `git archive failed for ref ${ref}`);
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
  }

  /**
   * Exports a subdirectory from `HEAD` of a git directory into `destDir`.
   *
   * Uses `git archive HEAD:<subdir>` so chapter folders can live anywhere under the source repo.
   *
   * @param gitDir - Absolute path to a `.git` dir or bare repo
   * @param subdir - Directory path relative to the repository root (nested OK)
   * @param destDir - Directory to extract into (created if missing)
   */
  async archiveSubtree(gitDir: string, subdir: string, destDir: string): Promise<void> {
    await this.assertSubtree(gitDir, subdir);
    await this.archive(gitDir, `HEAD:${subdir}`, destDir);
  }

  /**
   * Asserts that `subdir` exists as a tree under `HEAD`.
   *
   * @param gitDir - Absolute path to a `.git` dir or bare repo
   * @param subdir - Directory path relative to the repository root
   */
  async assertSubtree(gitDir: string, subdir: string): Promise<void> {
    const result = await this.run([
      "--git-dir",
      gitDir,
      "ls-tree",
      "-d",
      "--name-only",
      "HEAD",
      "--",
      subdir,
    ]);
    if (result.stdout.trim() === "") {
      throw new GitError(`source subdirectory not found on HEAD: ${subdir}`);
    }
  }

  /**
   * Runs `git` with `args`.
   */
  async run(args: string[], options: { cwd?: string } = {}): Promise<GitRunResult> {
    try {
      const { stdout, stderr } = await execFileAsync(this.gitBin, args, {
        cwd: options.cwd,
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
      });
      return { stdout, stderr };
    } catch (error) {
      throw wrapGitError(error, `git ${args.join(" ")} failed`);
    }
  }
}

/**
 * Returns whether a spawn error means the git binary is missing.
 */
function isMissingBinary(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

/**
 * Wraps a child_process failure as {@link GitError}.
 */
function wrapGitError(error: unknown, fallback: string): GitError {
  if (error instanceof GitError) {
    return error;
  }
  if (isMissingBinary(error)) {
    return new GitError(GIT_NOT_FOUND_MESSAGE, {
      cause: error,
    });
  }
  const stderr =
    typeof error === "object" &&
    error !== null &&
    "stderr" in error &&
    typeof (error as { stderr: unknown }).stderr === "string"
      ? (error as { stderr: string }).stderr.trim()
      : "";
  const message = stderr !== "" ? stderr : fallback;
  return new GitError(message, { cause: error });
}
