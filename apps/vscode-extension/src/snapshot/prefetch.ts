import type { GitClient } from "../git/client.ts";
import type { LearningSession } from "../workspace/loader.ts";
import { learningPaths } from "../workspace/paths.ts";
import { ensureSourceSnapshot, sourceSnapshotIsReady, uniqueSourceSubtrees } from "./archive.ts";

/** In-progress background prefetch for one learning workspace. */
let background: { workspaceRoot: string; abort: AbortController } | undefined;

/** Progress for one unique source-tree download. */
export interface SnapshotPrefetchProgress {
  /** Trees finished in this run (1-based after each write). */
  completed: number;
  /** Unique trees this run will write. */
  total: number;
  /** Source subtree just written, or `undefined` for an empty snapshot. */
  subtree: string | undefined;
  /** Notification increment for this step (`100 / total`). */
  increment: number;
}

/**
 * Runs prefetch work, optionally showing a progress UI.
 *
 * @param work - Prefetch body; `onProgress` updates the UI
 * @param abort - Controller cancelled when the extension deactivates
 */
export type SnapshotPrefetchProgressWrap = (
  work: (
    onProgress: (progress: SnapshotPrefetchProgress) => void,
    signal: AbortSignal,
  ) => Promise<void>,
  abort: AbortController,
) => Promise<void>;

/** Options for {@link startBackgroundSnapshotPrefetch}. */
export interface StartSnapshotPrefetchOptions {
  /** Optional logger (LearnByDiff output channel). */
  onLog?: (line: string) => void;
  /** Optional UI wrapper (notification progress). */
  runProgress?: SnapshotPrefetchProgressWrap;
}

/** Options for {@link prefetchAllChapterSnapshots}. */
export interface PrefetchChapterSnapshotsOptions {
  /** Stops between trees when aborted. */
  signal?: AbortSignal;
  /** Optional logger. */
  onLog?: (line: string) => void;
  /** Optional per-tree progress callback. */
  onProgress?: (progress: SnapshotPrefetchProgress) => void;
}

/**
 * Starts exporting unique chapter source trees into `.learn/snapshots`.
 *
 * Open Course already prefetches inside its progress notification. Call this
 * when a learning workspace is opened later: it re-checks the on-disk cache and
 * downloads only missing trees (same notification title). No-ops when a prefetch
 * for the same workspace is already running.
 *
 * @param git - Git client
 * @param session - Loaded learning session
 * @param options - Logging and optional progress UI
 */
export function startBackgroundSnapshotPrefetch(
  git: GitClient,
  session: LearningSession,
  options: StartSnapshotPrefetchOptions = {},
): void {
  if (background !== undefined && background.workspaceRoot === session.workspaceRoot) {
    return;
  }
  stopBackgroundSnapshotPrefetch();
  const abort = new AbortController();
  background = { workspaceRoot: session.workspaceRoot, abort };
  const started = background;
  const { onLog, runProgress } = options;
  /**
   * Logs a background prefetch failure unless this run was cancelled.
   *
   * @param error - Rejection from {@link prefetchAllChapterSnapshots}
   */
  const onPrefetchFailure = (error: unknown): void => {
    if (abort.signal.aborted) {
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    onLog?.(`Chapter snapshot prefetch failed: ${message}`);
  };
  /**
   * Clears the module-level handle when this run is still the active prefetch.
   */
  const onPrefetchSettled = (): void => {
    if (background === started) {
      background = undefined;
    }
  };
  /**
   * Downloads missing unique source trees, reporting progress when a UI is attached.
   *
   * @param onProgress - Per-tree progress callback
   * @param signal - Abort signal for this run
   */
  const work = async (
    onProgress: (progress: SnapshotPrefetchProgress) => void,
    signal: AbortSignal,
  ): Promise<void> => {
    await prefetchAllChapterSnapshots(git, session, { signal, onLog, onProgress });
  };
  /**
   * Runs prefetch with no progress UI (tests and callers that omit {@link runProgress}).
   *
   * @param inner - Prefetch body
   * @param controller - Abort controller for this run
   */
  const runWithoutProgress: SnapshotPrefetchProgressWrap = async (inner, controller) => {
    /**
     * Ignores prefetch progress when no UI wrapper is provided.
     *
     * @param _progress - Unused progress payload
     */
    const ignoreProgress = (_progress: SnapshotPrefetchProgress): void => {};
    await inner(ignoreProgress, controller.signal);
  };
  /**
   * Starts prefetch, skipping the progress UI when every unique tree is already cached.
   */
  const start = async (): Promise<void> => {
    let missing = 0;
    for (const subtree of uniqueSourceSubtrees(session.course)) {
      if (!(await sourceSnapshotIsReady(session.workspaceRoot, subtree))) {
        missing += 1;
      }
    }
    if (missing === 0 || abort.signal.aborted) {
      return;
    }
    const wrap = runProgress ?? runWithoutProgress;
    await wrap(work, abort);
  };
  void start().catch(onPrefetchFailure).finally(onPrefetchSettled);
}

/**
 * Cancels an in-flight background prefetch, if any.
 *
 * The current tree write still finishes; later trees are skipped.
 */
export function stopBackgroundSnapshotPrefetch(): void {
  background?.abort.abort();
  background = undefined;
}

/**
 * Exports every missing unique source subtree into `.learn/snapshots`.
 *
 * Stops between trees when `signal` is aborted. Shared `fromDir`/`toDir` paths
 * across chapters are written once.
 *
 * @param git - Git client
 * @param session - Loaded learning session
 * @param options - Abort, logging, and progress
 */
export async function prefetchAllChapterSnapshots(
  git: GitClient,
  session: LearningSession,
  options: PrefetchChapterSnapshotsOptions = {},
): Promise<void> {
  const { signal, onLog, onProgress } = options;
  if (signal?.aborted) {
    return;
  }
  const pending: (string | undefined)[] = [];
  for (const subtree of uniqueSourceSubtrees(session.course)) {
    if (!(await sourceSnapshotIsReady(session.workspaceRoot, subtree))) {
      pending.push(subtree);
    }
  }
  if (pending.length === 0 || signal?.aborted) {
    return;
  }
  const { sourceMirror } = learningPaths(session.workspaceRoot);
  onLog?.(`Prefetching ${pending.length} snapshot(s)…`);
  let completed = 0;
  for (const subtree of pending) {
    if (signal?.aborted) {
      return;
    }
    completed += 1;
    const label = subtree ?? "empty tree";
    onLog?.(`Caching ${label} (${completed}/${pending.length})…`);
    onProgress?.({
      completed,
      total: pending.length,
      subtree,
      increment: 100 / pending.length,
    });
    await ensureSourceSnapshot(git, sourceMirror, session.workspaceRoot, subtree);
  }
  if (signal?.aborted) {
    return;
  }
  onLog?.("Finished prefetching chapter snapshots.");
}
