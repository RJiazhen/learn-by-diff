import { describe, expect, test } from "vite-plus/test";
import {
  chapterPosition,
  currentChapter,
  nextChapter,
  previousChapter,
} from "../src/workspace/session.ts";
import type { LearningSession } from "../src/workspace/loader.ts";

const session: LearningSession = {
  workspaceRoot: "/tmp/learn",
  progress: { chapter: "effect", completed: false },
  course: {
    configDir: "/tmp/course",
    config: {
      protocolVersion: 1,
      id: "demo",
      title: "Demo",
      source: { repository: "https://example.com/src.git" },
      workspace: { install: "true", dev: "true", test: "true" },
    },
    chapters: [
      {
        id: "reactive",
        title: "Reactive",
        fromRef: "a",
        toRef: "b",
        entryFiles: ["a.ts"],
        tests: ["a.test.ts"],
      },
      {
        id: "effect",
        title: "Effect",
        fromRef: "b",
        toRef: "c",
        entryFiles: ["b.ts"],
        tests: ["b.test.ts"],
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
});
