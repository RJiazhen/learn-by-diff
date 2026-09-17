import type { ChapterChangedFile } from "@learn-by-diff/protocol";
import { describe, expect, test } from "vite-plus/test";
import { chapterRowIsExpandable } from "../src/ui/chapterRow.ts";

const oneChange: ChapterChangedFile[] = [{ path: "a.ts", kind: "M" }];

describe("chapterRowIsExpandable", () => {
  test("uses author-declared changedFiles when present", () => {
    expect(chapterRowIsExpandable(["a.ts"], true, [])).toBe(false);
    expect(chapterRowIsExpandable([], false, oneChange)).toBe(true);
  });

  test("hides the chevron when entryFiles is explicitly empty", () => {
    expect(chapterRowIsExpandable([], undefined)).toBe(false);
    expect(chapterRowIsExpandable([], true)).toBe(false);
  });

  test("keeps the chevron until the cheap from/to check finishes", () => {
    expect(chapterRowIsExpandable(undefined, undefined)).toBe(true);
    expect(chapterRowIsExpandable(["a.ts"], undefined)).toBe(true);
  });

  test("hides the chevron when the chapter has no from/to diffs", () => {
    expect(chapterRowIsExpandable(undefined, false)).toBe(false);
    expect(chapterRowIsExpandable(["a.ts"], false)).toBe(false);
  });

  test("keeps the chevron when the chapter has at least one from/to diff", () => {
    expect(chapterRowIsExpandable(undefined, true)).toBe(true);
    expect(chapterRowIsExpandable(["a.ts"], true)).toBe(true);
  });
});
