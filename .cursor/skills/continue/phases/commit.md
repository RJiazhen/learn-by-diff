# Phase: Commit（有未提交变更）

当功能分支上 `git status` 非空时进入——**包括暂存区已有 staged 文件**。此阶段在同一次 `/continue` 内完成：原子提交 → push →（无 OPEN PR 时）创建 PR。

遵循 [conventional-commit](/Users/a1/.cursor/skills/conventional-commit/SKILL.md)：

- 消息用 **English Conventional Commits**：`type(scope): description`
- **无关改动必须拆成多个原子 commit**（`git add -- <paths>` 按逻辑分组）
- 默认纳入**所有**待提交变更；仅当用户明确要求时才限制路径
- 不要提交密钥、`sandbox/**` 生成态、或其它 gitignored 产物
- 每个 commit 后确认无 Cursor co-author trailer；全部完成后 `git status` 确认干净

## 提交之后：立即 Ship（同一次调用）

用 `gh pr view --json number,state`（或 `gh pr list --head`）判断当前分支是否已有 **OPEN PR**。

- **已有 OPEN PR**：立即 `git push`（更新同一 PR）。**禁止** `gh pr create` / merge。汇报 commit 摘要与 PR URL 后停止。
- **尚无 PR**：立刻执行 [ship.md](./ship.md) 的 Push **和** 创建 PR（两步都在本阶段做完，不要停下来等下一次 `/continue`）。

**禁止**只 commit 就结束（那会把 push / 开 PR 拆成另一次调用）。
