import { describe, expect, test } from "vite-plus/test";
import {
  nextRevealChapterFiles,
  visibleFinishedChapterFiles,
} from "../src/workspace/chapterRevealOrder.ts";

describe("visibleFinishedChapterFiles", () => {
  const sorted = ["001-a.jsonc", "002-b.jsonc", "003-c.jsonc"];

  test("returns undefined until the first chapter is finished", () => {
    expect(visibleFinishedChapterFiles(sorted, new Set(["002-b.jsonc"]))).toBeUndefined();
    expect(
      visibleFinishedChapterFiles(sorted, new Set(["002-b.jsonc", "003-c.jsonc"])),
    ).toBeUndefined();
  });

  test("lists finished chapters in course order once chapter 1 is done", () => {
    expect(visibleFinishedChapterFiles(sorted, new Set(["001-a.jsonc"]))).toEqual(["001-a.jsonc"]);
    expect(visibleFinishedChapterFiles(sorted, new Set(["001-a.jsonc", "003-c.jsonc"]))).toEqual([
      "001-a.jsonc",
      "003-c.jsonc",
    ]);
  });
});

describe("nextRevealChapterFiles", () => {
  const sorted = ["001-a.jsonc", "002-b.jsonc", "003-c.jsonc"];

  test("returns undefined until chapter 1 is finished", () => {
    expect(nextRevealChapterFiles(sorted, new Set(["002-b.jsonc"]), 0)).toBeUndefined();
  });

  test("grows the visible prefix one chapter at a time", () => {
    const finished = new Set(["001-a.jsonc", "002-b.jsonc", "003-c.jsonc"]);
    expect(nextRevealChapterFiles(sorted, finished, 0)).toEqual(["001-a.jsonc"]);
    expect(nextRevealChapterFiles(sorted, finished, 1)).toEqual(["001-a.jsonc", "002-b.jsonc"]);
    expect(nextRevealChapterFiles(sorted, finished, 2)).toEqual([
      "001-a.jsonc",
      "002-b.jsonc",
      "003-c.jsonc",
    ]);
    expect(nextRevealChapterFiles(sorted, finished, 3)).toBeUndefined();
  });

  test("does not skip a gap when a later chapter finished first", () => {
    const finished = new Set(["001-a.jsonc", "003-c.jsonc"]);
    expect(nextRevealChapterFiles(sorted, finished, 0)).toEqual(["001-a.jsonc"]);
    // 002 is not finished, so the next reveal still only has chapter 1 + 003.
    expect(nextRevealChapterFiles(sorted, finished, 1)).toEqual(["001-a.jsonc", "003-c.jsonc"]);
  });
});
