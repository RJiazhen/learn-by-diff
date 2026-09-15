import { describe, expect, test } from "vite-plus/test";
import { chapterSearchPicks } from "../src/ui/searchChapter.ts";
import type { ChapterConfig } from "@learn-by-diff/protocol";

const chapters: ChapterConfig[] = [
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
];

describe("chapterSearchPicks", () => {
  test("labels match Explorer ordinal-title and mark the current chapter", () => {
    expect(chapterSearchPicks(chapters, "effect")).toEqual([
      {
        chapterId: "reactive",
        label: "1-Reactive",
        description: "reactive",
        current: false,
      },
      {
        chapterId: "effect",
        label: "2-Effect",
        description: "effect",
        current: true,
      },
    ]);
  });

  test("pads ordinals to the width of the chapter count", () => {
    /**
     * Builds a stub chapter config for ordinal-width tests.
     *
     * @param index - Zero-based chapter index
     */
    function stubChapter(index: number): ChapterConfig {
      return {
        id: `ch-${index + 1}`,
        title: `Chapter ${index + 1}`,
        fromDir: "a",
        toDir: "b",
        entryFiles: ["a.ts"],
      };
    }
    const many = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(stubChapter);
    const picks = chapterSearchPicks(many, "ch-1");
    expect(picks[0]?.label).toBe("01-Chapter 1");
    expect(picks[11]?.label).toBe("12-Chapter 12");
  });
});
