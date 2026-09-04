import { defineConfig, type DefaultTheme } from "vitepress";

const GITHUB = "https://github.com/RJiazhen/learn-by-diff";
const SITE_BASE = "/learn-by-diff/";

/**
 * Shared sidebar for the English placeholder locale.
 */
function englishSidebar(): DefaultTheme.Sidebar {
  return [
    {
      text: "Introduction",
      items: [
        { text: "Quick start", link: "/intro/quick-start" },
        { text: "Features", link: "/intro/features" },
        { text: "Author a course", link: "/intro/authoring" },
      ],
    },
  ];
}

/**
 * Shared sidebar for the Simplified Chinese locale.
 */
function chineseSidebar(): DefaultTheme.Sidebar {
  return [
    {
      text: "介绍",
      items: [
        { text: "快速开始", link: "/zh/intro/quick-start" },
        { text: "功能", link: "/zh/intro/features" },
        { text: "制作课程", link: "/zh/intro/authoring" },
      ],
    },
  ];
}

/** Top nav: one Introduction entry + one Sample course entry. */
const englishNav: DefaultTheme.NavItem[] = [
  { text: "Introduction", link: "/intro/quick-start" },
  { text: "Sample course", link: "/demo/" },
];

/** Top nav: 介绍 + 示例课程. */
const chineseNav: DefaultTheme.NavItem[] = [
  { text: "介绍", link: "/zh/intro/quick-start" },
  { text: "示例课程", link: "/zh/demo/" },
];

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
        nav: englishNav,
        sidebar: englishSidebar(),
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
      label: "简体中文",
      lang: "zh-CN",
      link: "/zh/",
      themeConfig: {
        nav: chineseNav,
        sidebar: chineseSidebar(),
        footer: {
          copyright: `Copyright © ${String(new Date().getFullYear())} Ruan Jiazhen`,
        },
        editLink: {
          pattern: `${GITHUB}/edit/main/apps/website/docs/:path`,
          text: "在 GitHub 上编辑此页",
        },
        outlineTitle: "本页目录",
        lastUpdatedText: "最后更新",
        docFooter: {
          prev: "上一页",
          next: "下一页",
        },
        darkModeSwitchLabel: "外观",
        sidebarMenuLabel: "菜单",
        returnToTopLabel: "回到顶部",
        langMenuLabel: "切换语言",
      },
    },
  },
});
