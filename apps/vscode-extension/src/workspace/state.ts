import { readFile, writeFile, mkdir } from "node:fs/promises";
import { learningPaths } from "./paths.ts";

/** Which chapter snapshot is currently exported into the student tree. */
export type ChapterSnapshotSide = "start" | "finish";

/** Persisted learning progress stored as JSON (no database). */
export interface LearningProgress {
  chapter: string;
  completed: boolean;
  /**
   * Whether the student tree holds this chapter's `fromDir` (`start`) or `toDir` (`finish`).
   * Older files omit this; treat as `start`.
   */
  appliedSide?: ChapterSnapshotSide;
  /**
   * @deprecated Older files recorded the last exported start chapter separately from `chapter`.
   */
  appliedStart?: string;
}

/**
 * Reads `.learn/progress.json`, or `undefined` when it is missing.
 *
 * @param workspaceRoot - Learning repository root
 */
export async function readProgress(workspaceRoot: string): Promise<LearningProgress | undefined> {
  try {
    const text = await readFile(learningPaths(workspaceRoot).progressFile, "utf8");
    const parsed: unknown = JSON.parse(text);
    if (!isProgress(parsed)) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

/**
 * Writes `.learn/progress.json`, creating `.learn` if needed.
 *
 * @param workspaceRoot - Learning repository root
 * @param progress - Progress document
 */
export async function writeProgress(
  workspaceRoot: string,
  progress: LearningProgress,
): Promise<void> {
  const { learnDir, progressFile } = learningPaths(workspaceRoot);
  await mkdir(learnDir, { recursive: true });
  await writeFile(progressFile, `${JSON.stringify(progress, null, 2)}\n`, "utf8");
}

/**
 * Returns whether the tree holds the chapter start or finish snapshot.
 *
 * @param progress - Persisted progress
 */
export function appliedSnapshotSide(progress: LearningProgress): ChapterSnapshotSide {
  return progress.appliedSide === "finish" ? "finish" : "start";
}

/**
 * Returns the English UI status label for an applied snapshot side.
 *
 * Used for `.learn/refs/` folder names so paths stay stable across locales.
 * Explorer and status bar use localized strings instead.
 *
 * @param side - Start (`fromDir`) or finish (`toDir`)
 */
export function chapterSnapshotStatusLabel(side: ChapterSnapshotSide): string {
  return side === "finish" ? "Completed" : "Not Started";
}

/**
 * Type guard for {@link LearningProgress}.
 *
 * @param value - Parsed JSON
 */
function isProgress(value: unknown): value is LearningProgress {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.chapter !== "string" || typeof record.completed !== "boolean") {
    return false;
  }
  if (
    record.appliedSide !== undefined &&
    record.appliedSide !== "start" &&
    record.appliedSide !== "finish"
  ) {
    return false;
  }
  return record.appliedStart === undefined || typeof record.appliedStart === "string";
}
