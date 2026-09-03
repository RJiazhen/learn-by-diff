import { describe, expect, test } from "vite-plus/test";
import {
  chapterOrdinal,
  chapterPosition,
  currentChapter,
  nextChapter,
  previousChapter,
} from "../src/workspace/session.ts";
import type { LearningSession } from "../src/workspace/loader.ts";
import { chapterSnapshotStatusLabel } from "../src/workspace/state.ts";

const session: LearningSession = {
  workspaceRoot: "/tmp/learn",
  progress: { chapter: "effect", completed: false },
  course: {
    configDir: "/tmp/course",
    config: {
      id: "demo",
      title: "Demo",
      source: { repository: "https://example.com/src.git" },
      chaptersDir: "chapters",
    },
    chapters: [
      {
        id: "reactive",
        title: "Reactive",
        fromDir: "start",
        toDir: "reactive",
        entryFiles: ["a.ts"],
      },
      {
        id: "effect",
        title: "Effect",
        fromDir: "reactive",
        toDir: "effect",
        entryFiles: ["b.ts"],
      },
    ],
  },
};

describe("session navigation", () => {
  test("current, previous, and next chapter", () => {
    expect(currentChapter(session).id).toBe("effect");
    expect(previousChapter(session)?.id).toBe("reactive");
    expect(nextChapter(session)).toBeUndefined();
    expect(chapterPosition(session.course, "effect")).toBe("2/2");
  });

  test("chapterOrdinal pads to the width of the total count", () => {
    expect(chapterOrdinal(0, 3)).toBe("1");
    expect(chapterOrdinal(0, 12)).toBe("01");
    expect(chapterOrdinal(11, 12)).toBe("12");
    expect(chapterOrdinal(0, 100)).toBe("001");
  });
});

describe("chapterSnapshotStatusLabel", () => {
  test("maps snapshot sides to Not Started and Completed", () => {
    expect(chapterSnapshotStatusLabel("start")).toBe("Not Started");
    expect(chapterSnapshotStatusLabel("finish")).toBe("Completed");
  });
});
