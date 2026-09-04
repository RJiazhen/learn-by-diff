# LearnByDiff website

VitePress site for [https://rjiazhen.github.io/learn-by-diff/](https://rjiazhen.github.io/learn-by-diff/). Default locale is English (placeholder pages); Simplified Chinese is the complete copy.

Top nav: **介绍** + **示例课程**. Sidebar under 介绍: 快速开始 / 功能 / 制作课程. Demo pages are not listed in the sidebar.

```bash
pnpm --filter website dev
pnpm --filter website build
```

`base` is `/learn-by-diff/` for GitHub Pages. GitHub → Settings → Pages → Source: GitHub Actions.

This monorepo overrides root `vite` to Vite+. VitePress needs stock Vite, so `pnpm-workspace.yaml` sets `vitepress>vite: npm:vite@…`.
