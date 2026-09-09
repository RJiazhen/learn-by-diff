# LearnByDiff website

VitePress site for [https://rjiazhen.github.io/learn-by-diff/](https://rjiazhen.github.io/learn-by-diff/). Locales: English (root), Simplified Chinese (`/zh/`), Traditional Chinese (`/zh-tw/`), Japanese (`/ja/`).

Intro nav + sidebar exist in every locale. The sample course (`/demo/`) is English only; other locales link there. Chapter pages under `/demo/` match `examples/demo-source` snapshot docs (`README.md` / `docs.md`).

```bash
pnpm --filter website dev
pnpm --filter website build
```

`base` is `/learn-by-diff/` for GitHub Pages. GitHub → Settings → Pages → Source: GitHub Actions.

This monorepo overrides root `vite` to Vite+. VitePress needs stock Vite, so `pnpm-workspace.yaml` sets `vitepress>vite: npm:vite@…`.
