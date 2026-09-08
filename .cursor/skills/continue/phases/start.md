# Phase: Start（尚未开始，通常在 `main`）

## 1. 解析需求来源

仓库固定为 **`RJiazhen/learn-by-diff`**。

**Fast path** — 用户消息含 `#38`、`RJiazhen/learn-by-diff#38` 或 GitHub issue URL：直接 `gh issue view`，不做模糊搜索。

**否则** — 从描述抽取 2–6 个关键词，依次：

```bash
gh issue list --repo RJiazhen/learn-by-diff --state open --search "<query>" --limit 20
# 无结果时再搜 all
gh issue list --repo RJiazhen/learn-by-diff --state all --search "<query>" --limit 20
```

选择最匹配的一条（标题/body/验收标准与用户描述一致；OPEN 优先）。找不到则**以用户描述为准**，不阻塞开发。

## 2. 建分支（必须从默认分支签出）

- `git checkout <default-branch>` → `git pull --ff-only origin <default-branch>`
- **禁止**在其它功能分支上 `checkout -b`
- 分支名：`<type>/<issue-or-topic-slug>`，如 `fix/38-open-course-url-decode`
- `gh issue view` 后整理验收 checklist

## 3. 开始实现

- 按 [AGENTS.md](../../../../AGENTS.md) 与 [docs/architecture.md](../../../../docs/architecture.md) 选读相关包边界
- 输出简短计划后立即编码
- 本阶段仅做分支与实现启动；**禁止** commit / push / 开 PR。
- 若本次调用内已完成全部验收项，仍须停止并等待**下一次** `/continue` 进入 **Commit**（不得同轮串联 Develop → Commit）。
- 若签出功能分支后**暂存区已有变更**（从 `main` 误带过来的工作除外，那种情况应先澄清），下次 `/continue` 会走 Commit，并在同一调用内 push + 开 PR。
