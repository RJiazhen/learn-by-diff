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

/** Optional flags for {@link GitClient.clone}. */
export interface GitCloneOptions {
  /** Create a shallow clone of this many commits (`git clone --depth`). */
  depth?: number;
  /** Checkout this branch or tag (`git clone --branch`). */
  branch?: string;
}

/** Optional flags for {@link GitClient.run}. */
export interface GitRunOptions {
  /** Working directory for the git process. */
  cwd?: string;
  /** Bytes written to stdin (used by `check-ignore --stdin`). */
  input?: string;
  /** Non-zero exit codes that should not be treated as failure. */
  allowExitCodes?: readonly number[];
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
   *
   * @param url - Git remote or local repository path
   * @param dest - Destination worktree directory
   * @param options - Optional shallow clone and branch checkout
   */
  async clone(url: string, dest: string, options: GitCloneOptions = {}): Promise<void> {
    await mkdir(path.dirname(dest), { recursive: true });
    const args = ["clone"];
    if (options.depth !== undefined) {
      args.push("--depth", String(options.depth));
    }
    if (options.branch !== undefined && options.branch !== "") {
      args.push("--branch", options.branch);
    }
    args.push("--", url, dest);
    await this.run(args);
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
   * Lists files under `workTree` that are not matched by git exclude rules.
   *
   * The folder does not need to be a git repository. Uses a temporary GIT_DIR
   * and `git ls-files -o --exclude-standard` so ignored trees such as
   * `node_modules/` are not walked.
   *
   * @param workTree - Directory that contains the `.gitignore` to apply
   */
  async listUnignoredWorkTreeFiles(workTree: string): Promise<string[]> {
    /**
     * Lists unignored files with `gitDir` as GIT_DIR and `workTree` as the work tree.
     *
     * @param gitDir - Temporary bare repository path
     */
    const listFiles = async (gitDir: string): Promise<string[]> => {
      const result = await this.run(
        [
          "--git-dir",
          gitDir,
          "--work-tree",
          workTree,
          "ls-files",
          "-z",
          "-o",
          "--exclude-standard",
        ],
        { cwd: workTree },
      );
      return splitNulPaths(result.stdout);
    };
    return await this.withScratchGitDir(listFiles);
  }

  /**
   * Returns the subset of `relativePaths` ignored by `workTree`'s exclude rules.
   *
   * Paths do not need to exist on disk. Uses `git check-ignore --stdin --no-index`
   * with a temporary GIT_DIR so the student workspace is not initialized as a repo.
   *
   * @param workTree - Directory that contains the `.gitignore` to apply
   * @param relativePaths - Slash-separated paths relative to `workTree`
   */
  async listIgnoredWorkTreePaths(workTree: string, relativePaths: string[]): Promise<Set<string>> {
    if (relativePaths.length === 0) {
      return new Set();
    }
    /**
     * Asks git which of `relativePaths` are ignored using `gitDir` as GIT_DIR.
     *
     * @param gitDir - Temporary bare repository path
     */
    const listIgnored = async (gitDir: string): Promise<Set<string>> => {
      const result = await this.run(
        [
          "--git-dir",
          gitDir,
          "--work-tree",
          workTree,
          "check-ignore",
          "--stdin",
          "-z",
          "--no-index",
        ],
        {
          cwd: workTree,
          input: `${relativePaths.join("\0")}\0`,
          allowExitCodes: [1],
        },
      );
      return new Set(splitNulPaths(result.stdout));
    };
    return await this.withScratchGitDir(listIgnored);
  }

  /**
   * Runs `git` with `args`.
   *
   * @param args - Git CLI arguments
   * @param options - Working directory, stdin, and tolerated exit codes
   */
  async run(args: string[], options: GitRunOptions = {}): Promise<GitRunResult> {
    try {
      return await this.exec(args, options);
    } catch (error) {
      throw wrapGitError(error, `git ${args.join(" ")} failed`);
    }
  }

  /**
   * Creates a temporary bare GIT_DIR, runs `useGitDir`, then deletes it.
   *
   * @param useGitDir - Receives the GIT_DIR path; must not keep it after returning
   */
  private async withScratchGitDir<T>(useGitDir: (gitDir: string) => Promise<T>): Promise<T> {
    const gitDir = await mkdtemp(path.join(tmpdir(), "learn-by-diff-excludes-"));
    try {
      await this.run(["init", "--bare", gitDir]);
      return await useGitDir(gitDir);
    } finally {
      await rm(gitDir, { recursive: true, force: true });
    }
  }

  /**
   * Spawns `git` and optionally writes stdin, treating listed exit codes as success.
   *
   * @param args - Git CLI arguments
   * @param options - Working directory, stdin, and tolerated exit codes
   */
  private exec(args: string[], options: GitRunOptions): Promise<GitRunResult> {
    const allowExitCodes = options.allowExitCodes ?? [];
    /**
     * Starts git, writes stdin, and settles when the process exits.
     *
     * @param resolve - Success path (including tolerated non-zero exits)
     * @param reject - Spawn or unexpected non-zero exit
     */
    const runProcess = (
      resolve: (value: GitRunResult) => void,
      reject: (reason: unknown) => void,
    ): void => {
      /**
       * Settles the process result, accepting configured non-zero exits.
       *
       * @param error - Spawn or non-zero-exit error, or `null` on success
       * @param stdout - Captured standard output
       * @param stderr - Captured standard error
       */
      const onClose = (error: Error | null, stdout: string, stderr: string): void => {
        if (error !== null) {
          const code = execExitCode(error);
          if (code !== undefined && allowExitCodes.includes(code)) {
            resolve({ stdout, stderr });
            return;
          }
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      };
      const child = execFile(
        this.gitBin,
        args,
        {
          cwd: options.cwd,
          encoding: "utf8",
          maxBuffer: 32 * 1024 * 1024,
        },
        onClose,
      );
      child.stdin?.end(options.input ?? "");
    };
    return new Promise(runProcess);
  }
}

/**
 * Splits a NUL-terminated `git -z` path list into POSIX relative paths.
 *
 * @param stdout - Raw git stdout
 */
function splitNulPaths(stdout: string): string[] {
  return stdout
    .split("\0")
    .filter((entry) => entry !== "")
    .map((entry) => entry.split(/[/\\]/).join("/"));
}

/**
 * Returns a numeric process exit code from an execFile error, or `undefined`.
 *
 * @param error - `child_process` failure
 */
function execExitCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === "number" ? code : undefined;
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
