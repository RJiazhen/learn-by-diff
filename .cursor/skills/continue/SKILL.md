---
name: continue
description: >-
  Repo-specific workflow to advance LearnByDiff development from issue to merge.
  Detects current phase and executes the matching step. On main, resolves a
  GitHub issue from the description, creates a branch, and starts work. Uncommitted
  changes (staged or unstaged) commit only — no push. A later invocation with a
  clean tree pushes and opens a PR. Merges only when the branch is clean and
  fully pushed. Use when the user asks to continue, ship, commit, open PR,
  or progress work on a feature.
---

# Continue (repo-specific)

## Core intent

**一条 skill 推进完整开发链路**：Issue → 分支 → 实现 → 原子提交 → Push 并开 PR → Merge → 收尾。

仓库：**`RJiazhen/learn-by-diff`**（默认分支 `main`）。

每次执行时**先检测当前阶段**，再**只读对应 phase 子文件**并执行；不要跳步，不要重复已完成步骤，不要一次性加载全部 phase 文件。

## 每次 `/continue` 只执行一个阶段（硬性）

**禁止**把 Develop、Commit、Ship 接在同一次调用里。Commit **只提交、不 push、不开 PR**。工作区干净后的下一次调用才进入 Ship（push + 创建 PR）。

典型节奏（功能分支上，自开发完成起）：

| 第几次 `/continue` | Phase        | 做什么                                             |
| ------------------ | ------------ | -------------------------------------------------- |
| 1                  | Develop      | 实现并跑验证；**不** commit / push / 开 PR         |
| 2                  | Commit       | 有未提交变更时原子提交；**停止**，不 push          |
| 3                  | Ship         | 工作区已干净：push，尚无 OPEN PR 时 `gh pr create` |
| 4+                 | Wait → Merge | 已有 OPEN PR 且与远程同步时，再次执行即合并        |

若调用时工作区 / 暂存区仍有未提交变更：只进入 **Commit**。不要在提交后接着 push。

执行完当前 phase 后**必须停止**；在 Response template 中写明「下次 `/continue` 将进入哪一阶段」；**不要**在同一轮对话里重新跑 phase detection 或进入下一阶段。

## Phase detection (run first)

在项目根目录并行收集状态：

```bash
git branch --show-current
git status --short
git diff --cached --quiet; echo "staged_exit:$?"   # 0 = 暂存区空
git symbolic-ref refs/remotes/origin/HEAD   # 默认分支，通常 main
git fetch origin
gh pr view --json number,state,url 2>/dev/null || gh pr list --head "$(git branch --show-current)" --json number,state,url --limit 1
```

**判定顺序**（从上到下，命中即停）：

| 条件                                                     | Phase       | 读取                                               |
| -------------------------------------------------------- | ----------- | -------------------------------------------------- |
| 在默认分支（`main`），无进行中的功能分支上下文           | **Start**   | [phases/start.md](./phases/start.md)               |
| 功能分支上仍有未实现验收项                               | **Develop** | [phases/develop-wait.md](./phases/develop-wait.md) |
| 工作区有未提交变更（`git status` 非空，含暂存区已变更）  | **Commit**  | [phases/commit.md](./phases/commit.md)             |
| 本地有未推送提交，或尚未开 PR                            | **Ship**    | [phases/ship.md](./phases/ship.md)                 |
| 当前分支已有 **OPEN** PR，工作区干净且已与 `origin` 同步 | **Merge**   | [phases/merge.md](./phases/merge.md)               |
| 已 Push、PR 已开、等待验收                               | **Wait**    | [phases/develop-wait.md](./phases/develop-wait.md) |

> **Merge 约定**：仅当工作区干净、本地没有未推送提交、且已有 OPEN PR 时，再次执行本 skill **即表示验收通过**。有未提交或未推送变更时不得进入 Merge。

## Response template

每次执行后输出：

```markdown
- Phase: `<Start | Develop | Commit | Ship | Merge | Wait>`
- Base branch: `<default-branch>`
- Branch: `<current-branch>`
- Requirement source: `<issue #n — title | user description>`
- Done this step: `<what was just completed>`
- Next step: `<what happens on next skill invocation or user action>`
```

## Safety & constraints

- **单次调用 = 单阶段**。Commit 禁止 `git push` / `gh pr create`。Ship 才 push；尚无 OPEN PR 时再 `gh pr create`。已有 OPEN PR 时 Ship 只 push。
- Issue：**只读**；不要擅自创建或关闭 Issue（Merge 后由 PR 的 `Closes`/`Fixes` 收尾除外）。
- 不要在 `main` 上直接开发或 `--force` push。
- 不要跳过原子提交把无关改动混在一个 commit 里。Commit **body 必写**（对照 `git log`）：写 why / 约束，禁止空 body 或复述 subject。
- 只有 **Merge** 阶段可合并 PR；步骤见 [phases/merge.md](./phases/merge.md)。
- 不要把 `sandbox/**` 生成态当源（gitignored）；课程夹具改 `examples/`。不要提交密钥。
- 协议 `src` 改动后先 `pnpm exec vp run @learn-by-diff/protocol#pack` 再跑扩展测试 / 宣称完成。
- 规范入口：[AGENTS.md](../../../AGENTS.md)、[docs/architecture.md](../../../docs/architecture.md)。
