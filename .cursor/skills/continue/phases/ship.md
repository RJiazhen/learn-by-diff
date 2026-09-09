# Phase: Ship（工作区已干净，待推送 / 开 PR）

仅当 `git status` 干净，且本地有未推送提交或尚未开 PR 时进入。

本阶段**禁止** `git commit`。不要从 Commit 阶段连着执行本文件。

若当前分支**已有 OPEN PR**：只执行 §1 Push，**禁止** `gh pr create` / merge，然后按 §3 汇报。

若当前分支**已有 OPEN PR**：只执行 §1 Push，**禁止** `gh pr create` / merge，然后按 §3 汇报。

## 1. Push

```bash
git push -u origin HEAD
```

## 2. 创建 PR（仅当尚无 OPEN PR）

紧接 §1，立即创建。标题与正文对齐 [AGENTS.md](../../../../AGENTS.md) 的 Conventional Commits 约定：

```bash
gh pr create --repo RJiazhen/learn-by-diff --base main --title "type(scope): short description" --body "$(cat <<'EOF'
## Summary
- …

## Test plan
- [ ] `pnpm exec vp check`
- [ ] `pnpm exec vp run -r test`
- [ ] …

EOF
)"
```

- 标题符合 Conventional Commits（英文）
- 正文含 Summary、Test plan checklist（按实际改动勾选：protocol pack、扩展 F5 / sandbox、website build）
- 关联 Issue：`Closes #n` 或 `Fixes #n`

## 3. 汇报

- PR URL
- `gh pr checks` 状态
- 站点生产地址（合入 `main` 后）：https://rjiazhen.github.io/learn-by-diff/
- **不要** merge — 等待用户验收或再次执行本 skill
