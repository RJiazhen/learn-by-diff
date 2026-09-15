import type { Course, CourseSource } from "@learn-by-diff/protocol";
import { resolveSourceSubtreePath } from "@learn-by-diff/protocol";
import { mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import path from "node:path";
import type { GitClient } from "../git/client.ts";
import { learningPaths, sourceSnapshotDir } from "../workspace/paths.ts";
import { directoryExists, exportSourceSubtree } from "../workspace/sourceStore.ts";

/** In-flight unique source-tree writes, keyed by workspace root and subtree. */
const inflightSnapshots = new Map<string, Promise<string>>();

/**
 * Returns a map key for one cached source subtree under a learning workspace.
 *
 * @param workspaceRoot - Learning workspace root
 * @param subtree - Source-repo-relative directory, or `undefined` for an empty tree
 */
function snapshotKey(workspaceRoot: string, subtree: string | undefined): string {
  return `${path.resolve(workspaceRoot)}\0${subtree ?? ""}`;
}

/**
 * Returns unique `fromDir`/`toDir` source subtrees in course order.
 *
 * Chapters that share a snapshot directory (typical chained `toDir` → next `fromDir`)
 * yield one entry so prefetch copies that tree once.
 *
 * @param course - Loaded course
 */
export function uniqueSourceSubtrees(course: Course): (string | undefined)[] {
  const seen = new Set<string>();
  const unique: (string | undefined)[] = [];
  for (const chapter of course.chapters) {
    for (const dir of [chapter.fromDir, chapter.toDir]) {
      const subtree = resolveSourceSubtreePath(course.config.source, dir);
      const key = subtree ?? "";
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      unique.push(subtree);
    }
  }
  return unique;
}

/**
 * Returns whether a source subtree is already exported under `.learn/snapshots`.
 *
 * @param workspaceRoot - Learning workspace root
 * @param subtree - Source-repo-relative directory, or `undefined` for an empty tree
 */
export async function sourceSnapshotIsReady(
  workspaceRoot: string,
  subtree: string | undefined,
): Promise<boolean> {
  return directoryExists(sourceSnapshotDir(workspaceRoot, subtree));
}

/**
 * Returns whether both sides of a chapter are present in the shared snapshot cache.
 *
 * @param workspaceRoot - Learning workspace root
 * @param fromDir - Chapter start directory relative to the source repo
 * @param toDir - Chapter goal directory relative to the source repo
 * @param source - Course source block
 */
export async function chapterSnapshotsAreReady(
  workspaceRoot: string,
  fromDir: string,
  toDir: string,
  source: CourseSource,
): Promise<boolean> {
  const fromSubtree = resolveSourceSubtreePath(source, fromDir);
  const toSubtree = resolveSourceSubtreePath(source, toDir);
  return (
    (await sourceSnapshotIsReady(workspaceRoot, fromSubtree)) &&
    (await sourceSnapshotIsReady(workspaceRoot, toSubtree))
  );
}

/**
 * Exports one source subtree into `.learn/snapshots` when it is not already cached.
 *
 * Concurrent callers for the same subtree share one write. The write is atomic
 * (temp directory, then rename).
 *
 * @param git - Git client
 * @param sourceStore - Materialized source store (mirror or tree copy)
 * @param workspaceRoot - Learning workspace
 * @param subtree - Source-repo-relative directory, or `undefined` for an empty tree
 */
export async function ensureSourceSnapshot(
  git: GitClient,
  sourceStore: string,
  workspaceRoot: string,
  subtree: string | undefined,
): Promise<string> {
  const key = snapshotKey(workspaceRoot, subtree);
  const inflight = inflightSnapshots.get(key);
  if (inflight !== undefined) {
    return inflight;
  }
  /**
   * Drops the in-flight handle so a later caller can rewrite if this write failed.
   */
  const clearInflight = (): void => {
    inflightSnapshots.delete(key);
  };
  const pending = materializeSourceSnapshot(git, sourceStore, workspaceRoot, subtree).finally(
    clearInflight,
  );
  inflightSnapshots.set(key, pending);
  return pending;
}

/**
 * Writes one source subtree into `.learn/snapshots` when it is not already complete.
 *
 * @param git - Git client
 * @param sourceStore - Materialized source store
 * @param workspaceRoot - Learning workspace
 * @param subtree - Source-repo-relative directory, or `undefined` for an empty tree
 */
async function materializeSourceSnapshot(
  git: GitClient,
  sourceStore: string,
  workspaceRoot: string,
  subtree: string | undefined,
): Promise<string> {
  const dest = sourceSnapshotDir(workspaceRoot, subtree);
  if (await directoryExists(dest)) {
    return dest;
  }
  const { snapshotsDir } = learningPaths(workspaceRoot);
  await mkdir(snapshotsDir, { recursive: true });
  const tmpDir = await mkdtemp(path.join(snapshotsDir, ".tmp-"));
  try {
    await exportSourceSubtree(git, sourceStore, subtree, tmpDir);
    await mkdir(path.dirname(dest), { recursive: true });
    await rm(dest, { recursive: true, force: true });
    await rename(tmpDir, dest);
  } catch (error) {
    await rm(tmpDir, { recursive: true, force: true });
    throw error;
  }
  return dest;
}

/**
 * Materializes from/to chapter directories into the shared `.learn/snapshots` cache.
 *
 * Reuses one on-disk tree when `fromDir` and `toDir` resolve to the same source
 * subtree, including across chapters.
 *
 * @param git - Git client
 * @param sourceStore - Materialized source store (mirror or tree copy)
 * @param workspaceRoot - Learning workspace
 * @param fromDir - Start directory relative to the source repo (or `source.root`)
 * @param toDir - Goal directory relative to the source repo (or `source.root`)
 * @param source - Course source block (applies optional `root` prefix)
 */
export async function writeChapterArchives(
  git: GitClient,
  sourceStore: string,
  workspaceRoot: string,
  fromDir: string,
  toDir: string,
  source: CourseSource,
): Promise<{ fromDir: string; toDir: string }> {
  const fromSubtree = resolveSourceSubtreePath(source, fromDir);
  const toSubtree = resolveSourceSubtreePath(source, toDir);
  const cachedFrom = await ensureSourceSnapshot(git, sourceStore, workspaceRoot, fromSubtree);
  const cachedTo = await ensureSourceSnapshot(git, sourceStore, workspaceRoot, toSubtree);
  return { fromDir: cachedFrom, toDir: cachedTo };
}

/**
 * Joins a snapshot root with a course-relative file path.
 *
 * @param snapshotRoot - Cached snapshot directory
 * @param relativeFile - Path from the chapter config
 */
export function snapshotFile(snapshotRoot: string, relativeFile: string): string {
  return path.join(snapshotRoot, ...relativeFile.split(/[/\\]/));
}
