import type { ChapterChangedFile } from "@learn-by-diff/protocol";
import { describe, expect, test } from "vite-plus/test";
import {
  chapterRowHasNoChanges,
  chapterRowIconId,
  chapterRowIsExpandable,
  chapterStatusIconId,
} from "../src/ui/chapterRow.ts";

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

describe("chapterRowHasNoChanges", () => {
  test("uses author-declared changedFiles when present", () => {
    expect(chapterRowHasNoChanges(["a.ts"], true, [])).toBe(true);
    expect(chapterRowHasNoChanges([], false, oneChange)).toBe(false);
  });

  test("treats an explicitly empty entryFiles list as no changes", () => {
    expect(chapterRowHasNoChanges([], undefined)).toBe(true);
  });

  test("uses a finished from/to check and keeps pending checks unknown", () => {
    expect(chapterRowHasNoChanges(undefined, false)).toBe(true);
    expect(chapterRowHasNoChanges(undefined, true)).toBe(false);
    expect(chapterRowHasNoChanges(undefined, undefined)).toBe(false);
    expect(chapterRowHasNoChanges(["a.ts"], undefined)).toBe(false);
  });
});

describe("chapterStatusIconId", () => {
  test("uses the Not Started and Completed action icons", () => {
    expect(chapterStatusIconId("start")).toBe("circle-large");
    expect(chapterStatusIconId("finish")).toBe("pass");
  });
});

describe("chapterRowIconId", () => {
  test("shows the applied status icon on the current chapter", () => {
    expect(chapterRowIconId("start")).toBe("circle-large");
    expect(chapterRowIconId("finish")).toBe("pass");
  });

  test("gives every other chapter the neutral chapter marker", () => {
    expect(chapterRowIconId(undefined)).toBe("mortar-board");
  });
});
