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
- 输出简短计划后立即编码。改完一个逻辑变更后按 [commit.md](./commit.md) 提交。
- 本阶段禁止 push / 开 PR。做完后停止；下次 `/continue` 在工作区干净且有未推送提交时进入 **Ship**。
