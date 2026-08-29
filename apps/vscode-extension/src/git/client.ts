import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { GitError } from "./errors.ts";

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
        throw new GitError("git was not found on PATH. Install Git and reopen the window.", {
          cause: error,
        });
      }
      throw error;
    }
  }

  /**
   * Clones `url` into `dest` (creates parent directories as needed).
   */
  async clone(url: string, dest: string, extraArgs: string[] = []): Promise<void> {
    await mkdir(path.dirname(dest), { recursive: true });
    await this.run(["clone", ...extraArgs, "--", url, dest]);
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
   * Returns unified diff text between two refs on a git directory.
   */
  async diff(gitDir: string, fromRef: string, toRef: string): Promise<string> {
    const result = await this.run(["--git-dir", gitDir, "diff", fromRef, toRef]);
    return result.stdout;
  }

  /**
   * Resolves a ref in a git directory; throws if it does not exist.
   */
  async assertRef(gitDir: string, ref: string): Promise<void> {
    await this.run(["--git-dir", gitDir, "rev-parse", "--verify", `${ref}^{commit}`]);
  }

  /**
   * Returns whether `cwd` has uncommitted changes (including untracked files).
   */
  async isWorkTreeDirty(cwd: string): Promise<boolean> {
    const result = await this.run(["status", "--porcelain"], { cwd });
    return result.stdout.trim() !== "";
  }

  /**
   * Initializes a git repository at `cwd` if needed and makes an initial commit.
   *
   * @param cwd - Learning workspace root
   * @param message - Commit message
   */
  async initWithCommit(cwd: string, message: string): Promise<void> {
    await this.run(["init"], { cwd });
    await this.run(["add", "-A"], { cwd });
    await this.run(
      [
        "-c",
        "user.email=learnbydiff@local",
        "-c",
        "user.name=LearnByDiff",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "--allow-empty",
        "-m",
        message,
      ],
      { cwd },
    );
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
    return new GitError("git was not found on PATH. Install Git and reopen the window.", {
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
