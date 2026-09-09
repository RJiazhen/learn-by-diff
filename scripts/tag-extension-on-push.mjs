import { execFileSync } from "node:child_process";
import path from "node:path";
import { stdin } from "node:process";
import { text } from "node:stream/consumers";
import { fileURLToPath } from "node:url";

/** Path of the package whose `version` field drives release tags. */
export const EXTENSION_PACKAGE_JSON = "apps/vscode-extension/package.json";

/**
 * Returns whether `sha` is Git's all-zero placeholder for a missing ref.
 */
export function isZeroSha(sha) {
  return /^0+$/.test(sha);
}

/**
 * Builds the annotated release tag name for an extension package version.
 */
export function tagNameForVersion(version) {
  return `v${version}`;
}

/**
 * Reads the `version` string from extension `package.json` text.
 * Returns null when the JSON has no non-empty string `version`.
 */
export function parseExtensionVersion(packageJsonText) {
  const parsed = JSON.parse(packageJsonText);
  return typeof parsed.version === "string" && parsed.version.length > 0 ? parsed.version : null;
}

/**
 * Parses one `pre-push` stdin line into local/remote ref and SHA fields.
 * Returns null for blank lines.
 */
export function parsePrePushLine(line) {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parts = trimmed.split(/[ \t]+/);
  if (parts.length < 4) {
    throw new Error(`Invalid pre-push line: ${line}`);
  }
  return {
    localRef: parts[0],
    localSha: parts[1],
    remoteRef: parts[2],
    remoteSha: parts[3],
  };
}

/**
 * Parses the full `pre-push` stdin payload into ref updates.
 */
export function parsePrePushStdin(input) {
  return input
    .split(/\r?\n/)
    .map((line) => parsePrePushLine(line))
    .filter((update) => update !== null);
}

/**
 * Runs `git` in `cwd` and returns trimmed stdout, or `null` when `allowFail` and git exits non-zero.
 */
function runGit(args, cwd, options = {}) {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    if (options.allowFail) {
      return null;
    }
    throw error;
  }
}

/**
 * Reads the extension package version at `sha`, or null if that file does not exist.
 */
export function readVersionAt(sha, cwd) {
  const exists = runGit(["cat-file", "-e", `${sha}:${EXTENSION_PACKAGE_JSON}`], cwd, {
    allowFail: true,
  });
  if (exists === null) {
    return null;
  }
  return parseExtensionVersion(runGit(["show", `${sha}:${EXTENSION_PACKAGE_JSON}`], cwd));
}

/**
 * Returns the commit to compare `package.json` against for this ref update.
 * New branches compare against the parent of the oldest commit not already on the remote.
 */
export function resolvePreviousSha(update, remote, cwd) {
  if (!isZeroSha(update.remoteSha)) {
    return update.remoteSha;
  }
  const revListArgs = ["rev-list", "--reverse", update.localSha, "--not", "--remotes"];
  if (remote && !looksLikeUrl(remote)) {
    revListArgs.push(`--remotes=${remote}`);
    // `--remotes` and `--remotes=name` cannot both apply; rebuild when a remote name is given.
    revListArgs.splice(4, 1);
  }
  const listed = runGit(revListArgs, cwd, { allowFail: true });
  if (!listed) {
    return null;
  }
  const oldest = listed.split("\n")[0];
  return runGit(["rev-parse", "--verify", `${oldest}^`], cwd, { allowFail: true });
}

/**
 * Returns whether `remote` looks like a URL rather than a remote name.
 */
function looksLikeUrl(remote) {
  return /:\/\//.test(remote) || remote.includes("@") || remote.startsWith("/");
}

/**
 * Creates annotated tag `tag` at `sha` when missing, or throws if it points at another commit.
 */
export function ensureAnnotatedTag(tag, sha, cwd) {
  const existing = runGit(["rev-parse", "--verify", `refs/tags/${tag}`], cwd, { allowFail: true });
  if (existing !== null) {
    const peeled = runGit(["rev-parse", "--verify", `${tag}^{commit}`], cwd);
    if (peeled !== sha) {
      throw new Error(`Tag ${tag} already exists at ${peeled}, not ${sha}`);
    }
    return { created: false };
  }
  runGit(["tag", "-a", tag, "-m", tag, sha], cwd);
  return { created: true };
}

/**
 * Pushes `tag` to `remote` without re-entering the pre-push hook.
 */
export function pushTag(tag, remote, cwd) {
  runGit(["push", "--no-verify", remote, `refs/tags/${tag}`], cwd);
}

/**
 * Creates and pushes `v<version>` for each branch whose extension version changed in this push.
 */
export function tagExtensionVersionOnPush({ updates, remote, cwd, push = true }) {
  const seen = new Set();
  const tagged = [];
  for (const update of updates) {
    if (!update.localRef.startsWith("refs/heads/")) {
      continue;
    }
    if (isZeroSha(update.localSha)) {
      continue;
    }
    const previousSha = resolvePreviousSha(update, remote, cwd);
    const before = previousSha ? readVersionAt(previousSha, cwd) : null;
    const after = readVersionAt(update.localSha, cwd);
    if (after === null || after === before) {
      continue;
    }
    const tag = tagNameForVersion(after);
    if (seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    ensureAnnotatedTag(tag, update.localSha, cwd);
    if (push) {
      pushTag(tag, remote, cwd);
    }
    tagged.push(tag);
    console.log(`Tagged ${tag} at ${update.localSha.slice(0, 12)}`);
  }
  return tagged;
}

/**
 * Reads pre-push stdin and tags the extension version when it changed on a pushed branch.
 */
export async function main({ input, argv = process.argv.slice(2), cwd = process.cwd() } = {}) {
  const remote = argv[0];
  if (!remote) {
    throw new Error("pre-push hook expected a remote name or URL as the first argument");
  }
  const stdinText = input === undefined ? await text(stdin) : input;
  return tagExtensionVersionOnPush({
    updates: parsePrePushStdin(stdinText),
    remote,
    cwd,
    push: true,
  });
}

/**
 * Returns whether this file is the process entry point (not an imported module).
 */
function isExecutedDirectly() {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (isExecutedDirectly()) {
  await main();
}
