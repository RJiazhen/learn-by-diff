# Phase: Merge（OPEN PR + 已推送 + 用户执行本 skill）

仅当工作区干净、没有未推送提交、且已有 OPEN PR 时进入。此时视为验收通过（见 continue skill Merge 约定）。

若仍有未提交变更，回到 [commit.md](./commit.md)（会提交并 push）；若仅未推送，回到 [ship.md](./ship.md)。**不要**在未同步时合并。

## 1. 检查并合并

```bash
gh pr checks
gh pr view --json mergeable,mergeStateStatus,url,title
```

CI 未通过则停止并汇报失败项，不要 merge。

通过后：

```bash
gh pr merge --squash --delete-branch
```

若 GitHub 不允许 squash，改用仓库默认的 merge 方式；**禁止** `--force` push 到 `main`。

## 2. 收尾

```bash
git checkout main
git pull --ff-only origin main
git branch -d <feature-branch> 2>/dev/null || true
```

- 汇报已合并的 PR URL
- 网站由 `.github/workflows/website.yml` 在 `main` 上部署到 GitHub Pages：https://rjiazhen.github.io/learn-by-diff/
- 不要再改已关闭 Issue（`Closes`/`Fixes` 会随 merge 关闭）
