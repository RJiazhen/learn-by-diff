import { defineConfig, type DefaultTheme } from "vitepress";

const GITHUB = "https://github.com/RJiazhen/learn-by-diff";
const SITE_BASE = "/learn-by-diff/";

/** Shared chrome strings for a non-English locale. */
interface LocaleChrome {
  label: string;
  lang: string;
  link: string;
  intro: string;
  start: string;
  features: string;
  authoring: string;
  sample: string;
  editLink: string;
  outlineTitle: string;
  lastUpdatedText: string;
  prev: string;
  next: string;
  darkModeSwitchLabel: string;
  sidebarMenuLabel: string;
  returnToTopLabel: string;
  langMenuLabel: string;
}

/**
 * Builds Introduction + Sample course nav. Sample course always points at the English demo.
 */
function introNav(prefix: string, intro: string, sample: string): DefaultTheme.NavItem[] {
  return [
    { text: intro, link: `${prefix}/intro/start` },
    { text: sample, link: "/demo/" },
  ];
}

/**
 * Builds the Introduction sidebar for one locale prefix (`""`, `/zh`, `/zh-tw`, `/ja`).
 */
function introSidebar(
  prefix: string,
  section: string,
  start: string,
  features: string,
  authoring: string,
): DefaultTheme.Sidebar {
  return [
    {
      text: section,
      items: [
        { text: start, link: `${prefix}/intro/start` },
        { text: features, link: `${prefix}/intro/features` },
        { text: authoring, link: `${prefix}/intro/authoring` },
      ],
    },
  ];
}

/**
 * Theme config shared by Simplified Chinese, Japanese, and Traditional Chinese.
 */
function cjkTheme(chrome: LocaleChrome): DefaultTheme.Config {
  return {
    nav: introNav(chrome.link.replace(/\/$/, ""), chrome.intro, chrome.sample),
    sidebar: introSidebar(
      chrome.link.replace(/\/$/, ""),
      chrome.intro,
      chrome.start,
      chrome.features,
      chrome.authoring,
    ),
    footer: {
      copyright: `Copyright © ${String(new Date().getFullYear())} Ruan Jiazhen`,
    },
    editLink: {
      pattern: `${GITHUB}/edit/main/apps/website/docs/:path`,
      text: chrome.editLink,
    },
    outlineTitle: chrome.outlineTitle,
    lastUpdatedText: chrome.lastUpdatedText,
    docFooter: {
      prev: chrome.prev,
      next: chrome.next,
    },
    darkModeSwitchLabel: chrome.darkModeSwitchLabel,
    sidebarMenuLabel: chrome.sidebarMenuLabel,
    returnToTopLabel: chrome.returnToTopLabel,
    langMenuLabel: chrome.langMenuLabel,
  };
}

const zhChrome: LocaleChrome = {
  label: "简体中文",
  lang: "zh-CN",
  link: "/zh/",
  intro: "介绍",
  start: "快速开始",
  features: "功能",
  authoring: "制作课程",
  sample: "示例课程",
  editLink: "在 GitHub 上编辑此页",
  outlineTitle: "本页目录",
  lastUpdatedText: "最后更新",
  prev: "上一页",
  next: "下一页",
  darkModeSwitchLabel: "外观",
  sidebarMenuLabel: "菜单",
  returnToTopLabel: "回到顶部",
  langMenuLabel: "切换语言",
};

const jaChrome: LocaleChrome = {
  label: "日本語",
  lang: "ja",
  link: "/ja/",
  intro: "紹介",
  start: "はじめに",
  features: "機能",
  authoring: "コースを作る",
  sample: "サンプルコース",
  editLink: "GitHub でこのページを編集",
  outlineTitle: "目次",
  lastUpdatedText: "最終更新",
  prev: "前のページ",
  next: "次のページ",
  darkModeSwitchLabel: "外観",
  sidebarMenuLabel: "メニュー",
  returnToTopLabel: "トップに戻る",
  langMenuLabel: "言語",
};

const zhTwChrome: LocaleChrome = {
  label: "繁體中文",
  lang: "zh-TW",
  link: "/zh-tw/",
  intro: "介紹",
  start: "快速開始",
  features: "功能",
  authoring: "製作課程",
  sample: "示例課程",
  editLink: "在 GitHub 上編輯此頁",
  outlineTitle: "本頁目錄",
  lastUpdatedText: "最後更新",
  prev: "上一頁",
  next: "下一頁",
  darkModeSwitchLabel: "外觀",
  sidebarMenuLabel: "選單",
  returnToTopLabel: "回到頂端",
  langMenuLabel: "切換語言",
};

export default defineConfig({
  base: SITE_BASE,
  title: "LearnByDiff",
  description: "Learn to code by feature-increment diffs in VS Code and Cursor.",
  lastUpdated: true,
  lang: "en",
  appearance: "dark",
  head: [
    ["link", { rel: "icon", href: `${SITE_BASE}icon.png` }],
    ["meta", { name: "theme-color", content: "#00754c" }],
  ],
  themeConfig: {
    logo: "/icon.png",
    socialLinks: [{ icon: "github", link: GITHUB }],
    search: {
      provider: "local",
    },
  },
  locales: {
    root: {
      label: "English",
      lang: "en",
      themeConfig: {
        nav: introNav("", "Introduction", "Sample course"),
        sidebar: introSidebar("", "Introduction", "Get started", "Features", "Author a course"),
        footer: {
          message: "Released under the MIT License.",
          copyright: `Copyright © ${String(new Date().getFullYear())} LearnByDiff`,
        },
        editLink: {
          pattern: `${GITHUB}/edit/main/apps/website/docs/:path`,
          text: "Edit this page on GitHub",
        },
      },
    },
    zh: {
      label: zhChrome.label,
      lang: zhChrome.lang,
      link: zhChrome.link,
      themeConfig: cjkTheme(zhChrome),
    },
    "zh-tw": {
      label: zhTwChrome.label,
      lang: zhTwChrome.lang,
      link: zhTwChrome.link,
      themeConfig: cjkTheme(zhTwChrome),
    },
    ja: {
      label: jaChrome.label,
      lang: jaChrome.lang,
      link: jaChrome.link,
      themeConfig: cjkTheme(jaChrome),
    },
  },
});
