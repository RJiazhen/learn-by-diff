import { readFileSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";

type MenuContribution = {
  command?: string;
  submenu?: string;
  group?: string;
};

type ExtensionManifest = {
  contributes: {
    menus: Record<string, MenuContribution[]>;
    submenus: { id: string; icon?: string }[];
  };
};

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as ExtensionManifest;

/**
 * Returns contributions registered for one menu id.
 *
 * @param menuId - `contributes.menus` key
 */
function menuItems(menuId: string): MenuContribution[] {
  return manifest.contributes.menus[menuId] ?? [];
}

/**
 * Returns the group string for a command in a menu.
 *
 * @param items - Menu contributions
 * @param command - Command id
 */
function commandGroup(items: MenuContribution[], command: string): string | undefined {
  return items.find((item) => item.command === command)?.group;
}

describe("course view menus", () => {
  test("folds course navigation into the view More Actions menu", () => {
    const title = menuItems("view/title");
    for (const command of [
      "learnByDiff.openCourse",
      "learnByDiff.previousChapter",
      "learnByDiff.nextChapter",
      "learnByDiff.copyCurrentCourseUrl",
      "learnByDiff.copyOneClickOpenUrl",
    ]) {
      expect(commandGroup(title, command)?.startsWith("navigation")).toBe(false);
    }
    expect(commandGroup(title, "learnByDiff.scrollToCurrentChapter")).toMatch(/^navigation/);
    expect(commandGroup(title, "learnByDiff.searchChapter")).toMatch(/^navigation/);
  });

  test("puts folder actions in the chapter More menu instead of inline icons", () => {
    const itemContext = menuItems("view/item/context");
    const inlineCommands = itemContext
      .filter((item) => item.group?.startsWith("inline"))
      .map((item) => item.command ?? item.submenu);
    expect(inlineCommands).not.toContain("learnByDiff.openChapterStartFolder");
    expect(inlineCommands).not.toContain("learnByDiff.openChapterFinishFolder");
    expect(inlineCommands).toContain("learnByDiff.chapterMore");

    const more = menuItems("learnByDiff.chapterMore").map((item) => item.command);
    expect(more).toEqual([
      "learnByDiff.openChapterStartFolder",
      "learnByDiff.openChapterFinishFolder",
    ]);
    const chapterMore = manifest.contributes.submenus.find(
      (submenu) => submenu.id === "learnByDiff.chapterMore",
    );
    expect(chapterMore?.icon).toBeDefined();
  });
});
