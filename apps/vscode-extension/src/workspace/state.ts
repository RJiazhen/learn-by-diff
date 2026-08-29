import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { learningPaths } from "./paths.ts";

/** Persisted learning progress stored as JSON (no database). */
export interface LearningProgress {
  chapter: string;
  completed: boolean;
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
 * Type guard for {@link LearningProgress}.
 */
function isProgress(value: unknown): value is LearningProgress {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.chapter === "string" && typeof record.completed === "boolean";
}

/**
 * Returns the progress file path for tests and loaders.
 *
 * @param workspaceRoot - Learning repository root
 */
export function progressFilePath(workspaceRoot: string): string {
  return path.join(learningPaths(workspaceRoot).progressFile);
}
