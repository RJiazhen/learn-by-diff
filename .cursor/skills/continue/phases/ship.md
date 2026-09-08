# Phase: Ship（工作区已干净，待推送 / 开 PR）

在以下情况进入：

- **Commit 阶段刚提交完**（同一次 `/continue` 内继续执行本文件），或
- 工作区干净，但本地有未推送提交或尚未开 PR（例如提交发生在本 skill 之外）

本阶段**禁止** `git commit`。**Push 与创建 PR 必须在同一次调用内完成**，不要拆成两次 `/continue`。

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
