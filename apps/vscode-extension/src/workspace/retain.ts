import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyEdits, modify } from "jsonc-parser";
import ignore from "ignore";
import {
  COURSE_FILE_NAME,
  DEFAULT_RETAIN_PATHS,
  normalizeRetainPattern,
  parseCourseJsonc,
} from "@learn-by-diff/protocol";

/**
 * Paths the learning copy of `course.jsonc` always keeps, after the author's `retain` list.
 *
 * These are extension machinery, not author defaults. Patterns use `.gitignore` rules from
 * the learning folder root.
 */
export const BUILTIN_RETAIN_PATHS = [".git", ".learn", ".gitignore", "*.code-workspace"] as const;

/**
 * Returns whether `relative` is covered by a `retain` entry using `.gitignore` matching.
 *
 * Patterns are evaluated from the learning folder root, same rules as `.gitignore`
 * (`node_modules` matches every `node_modules` directory; `/node_modules` matches only
 * the root one; trailing `/` matches directories only).
 *
 * @param relative - Path relative to the learning folder, using `/` or `\`
 * @param retain - Course `retain` patterns, including built-ins when already merged
 */
export function isRetainedRelativePath(relative: string, retain: readonly string[]): boolean {
  const normalized = relative
    .split(/[/\\]/)
    .filter((segment) => segment !== "" && segment !== ".")
    .join("/");
  if (normalized === "") {
    return false;
  }
  const patterns = retain
    .map((entry) => normalizeRetainPattern(entry) ?? entry.trim())
    .filter((entry) => entry !== "");
  if (patterns.length === 0) {
    return false;
  }
  return ignore().add(patterns).ignores(normalized);
}

/**
 * Appends missing built-in `retain` paths to the copied `course.jsonc`.
 *
 * Does not change the author's course file. An omitted `retain` is written as
 * `node_modules` plus the built-ins. An explicit list, including `[]`, keeps those
 * author paths and then gains any built-in that is not already present. JSONC comments
 * are preserved. The file is left unchanged when it already has that list.
 *
 * @param courseDir - `.learn/course` directory that contains the copied `course.jsonc`
 */
export async function ensureBuiltinRetain(courseDir: string): Promise<void> {
  const filePath = path.join(courseDir, COURSE_FILE_NAME);
  const text = await readFile(filePath, "utf8");
  const parsed = parseCourseJsonc(text, filePath);
  const next = retainWithBuiltins(parsed.retain);
  if (sameStringList(parsed.retain, next)) {
    return;
  }
  const edits = modify(text, ["retain"], next, {
    formattingOptions: { insertSpaces: true, tabSize: 2 },
  });
  await writeFile(filePath, applyEdits(text, edits), "utf8");
}

/**
 * Builds the learning-copy `retain` list: author patterns (or the default) then missing built-ins.
 *
 * @param authorRetain - Parsed `retain`, or `undefined` when the field was omitted
 */
function retainWithBuiltins(authorRetain: readonly string[] | undefined): string[] {
  const base =
    authorRetain === undefined
      ? [...DEFAULT_RETAIN_PATHS]
      : authorRetain.map((entry) => normalizeRetainPattern(entry) ?? entry);
  const next = [...base];
  const seen = new Set(next);
  for (const builtin of BUILTIN_RETAIN_PATHS) {
    if (!seen.has(builtin)) {
      next.push(builtin);
      seen.add(builtin);
    }
  }
  return next;
}

/**
 * Returns whether `actual` is already the list that would be written.
 *
 * @param actual - `retain` as parsed from the file; `undefined` when omitted
 * @param expected - List {@link retainWithBuiltins} would write
 */
function sameStringList(
  actual: readonly string[] | undefined,
  expected: readonly string[],
): boolean {
  if (actual === undefined || actual.length !== expected.length) {
    return false;
  }
  return actual.every((entry, index) => entry === expected[index]);
}

/** Files and directories present in a snapshot tree, as posix paths relative to its root. */
interface SnapshotTree {
  files: Set<string>;
  dirs: Set<string>;
}

/**
 * Deletes learning-folder paths that are neither retained nor present in the snapshot.
 *
 * Walks after the snapshot has been overlaid, so in-snapshot files stay and only extras
 * are removed. A retained path keeps its whole subtree. Parents of snapshot files stay.
 *
 * @param workspaceRoot - Learning folder
 * @param snapshotRoot - Cached snapshot directory; a missing directory means an empty snapshot
 * @param retain - `.gitignore`-style patterns that must not be deleted
 */
export async function prunePathsOutsideSnapshot(
  workspaceRoot: string,
  snapshotRoot: string,
  retain: readonly string[],
): Promise<void> {
  const snapshot = await collectSnapshotTree(snapshotRoot);
  await pruneDirectory(workspaceRoot, "", snapshot, retain);
}

/**
 * Lists snapshot files and directories under `root`.
 *
 * @param root - Snapshot directory; missing means an empty tree
 */
async function collectSnapshotTree(root: string): Promise<SnapshotTree> {
  const tree: SnapshotTree = { files: new Set(), dirs: new Set() };
  await walkSnapshot(root, "", tree);
  return tree;
}

/**
 * Adds `dir`'s children to `tree`.
 *
 * @param dir - Absolute directory
 * @param relative - Posix path of `dir` under the snapshot root; empty at the root
 * @param tree - Accumulator
 */
async function walkSnapshot(dir: string, relative: string, tree: SnapshotTree): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const childRelative = relative === "" ? entry.name : `${relative}/${entry.name}`;
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      tree.dirs.add(childRelative);
      await walkSnapshot(path.join(dir, entry.name), childRelative, tree);
      continue;
    }
    tree.files.add(childRelative);
  }
}

/**
 * Removes children of `dir` that the snapshot does not contain and `retain` does not cover.
 *
 * @param dir - Absolute directory being pruned
 * @param relative - Posix path of `dir` under the learning folder; empty at the root
 * @param snapshot - Paths that must stay because they were just copied
 * @param retain - `.gitignore`-style patterns that must stay even when absent from the snapshot
 */
async function pruneDirectory(
  dir: string,
  relative: string,
  snapshot: SnapshotTree,
  retain: readonly string[],
): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const childRelative = relative === "" ? entry.name : `${relative}/${entry.name}`;
    if (isRetainedRelativePath(childRelative, retain)) {
      continue;
    }
    const childPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      if (!snapshot.dirs.has(childRelative) && !snapshotHasDescendant(snapshot, childRelative)) {
        await rm(childPath, { recursive: true, force: true });
        continue;
      }
      await pruneDirectory(childPath, childRelative, snapshot, retain);
      continue;
    }
    if (!snapshot.files.has(childRelative)) {
      await rm(childPath, { force: true });
    }
  }
}

/**
 * Returns whether the snapshot contains a path under `dirRelative`.
 *
 * @param snapshot - Snapshot file and directory sets
 * @param dirRelative - Posix directory path
 */
function snapshotHasDescendant(snapshot: SnapshotTree, dirRelative: string): boolean {
  const prefix = `${dirRelative}/`;
  for (const file of snapshot.files) {
    if (file.startsWith(prefix)) {
      return true;
    }
  }
  for (const dir of snapshot.dirs) {
    if (dir.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}
