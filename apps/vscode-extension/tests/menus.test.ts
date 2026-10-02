import { readFileSync } from "node:fs";
import { describe, expect, test } from "vite-plus/test";

type MenuContribution = {
  command?: string;
  submenu?: string;
  group?: string;
};

type CommandContribution = {
  command: string;
  title: string;
  category?: string;
};

type ExtensionManifest = {
  contributes: {
    commands: CommandContribution[];
    menus: Record<string, MenuContribution[]>;
    submenus: { id: string; icon?: string }[];
  };
};

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as ExtensionManifest;

const nlsLocales = ["", ".zh-cn", ".zh-tw", ".ja"] as const;

/**
 * Loads one package.nls locale map.
 *
 * @param suffix - Locale file suffix, empty for English
 */
function loadNls(suffix: (typeof nlsLocales)[number]): Record<string, string> {
  return JSON.parse(
    readFileSync(new URL(`../package.nls${suffix}.json`, import.meta.url), "utf8"),
  ) as Record<string, string>;
}

/**
 * Resolves a contributed command title in one locale.
 *
 * @param commandId - Command id from package.json
 * @param nls - Locale string map
 */
function commandTitle(commandId: string, nls: Record<string, string>): string {
  const command = manifest.contributes.commands.find((item) => item.command === commandId);
  const title = command?.title ?? "";
  const key = title.startsWith("%") && title.endsWith("%") ? title.slice(1, -1) : title;
  return nls[key] ?? title;
}

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

  test("view button titles omit the LearnByDiff prefix", () => {
    const commandIds = new Set<string>();
    for (const menuId of ["view/title", "view/item/context", "learnByDiff.chapterMore"]) {
      for (const item of menuItems(menuId)) {
        if (item.command !== undefined) {
          commandIds.add(item.command);
        }
      }
    }
    for (const suffix of nlsLocales) {
      const nls = loadNls(suffix);
      for (const commandId of commandIds) {
        expect(commandTitle(commandId, nls)).not.toMatch(/LearnByDiff:/);
      }
    }
    const categorized = manifest.contributes.commands.filter(
      (command) => command.category === "LearnByDiff",
    );
    expect(categorized.map((command) => command.command)).toEqual([
      "learnByDiff.openCourse",
      "learnByDiff.nextChapter",
      "learnByDiff.previousChapter",
      "learnByDiff.searchChapter",
      "learnByDiff.copyCurrentCourseUrl",
      "learnByDiff.copyWorkspaceCourseUrl",
      "learnByDiff.copyOneClickOpenUrl",
      "learnByDiff.openFileDiff",
    ]);
  });
});
