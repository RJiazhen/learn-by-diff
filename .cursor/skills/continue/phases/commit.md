# Phase: Commit（有未提交变更）

当功能分支上 `git status` 非空时进入——**包括暂存区已有 staged 文件**。此阶段在同一次 `/continue` 内完成：原子提交 → push →（无 OPEN PR 时）创建 PR。

拆分与暂存遵循 [conventional-commit](/Users/a1/.cursor/skills/conventional-commit/SKILL.md)。**覆盖**其中「body 可选 / subject 够了就可以不写」的规则：本仓库 **几乎总是要写 body**，且 body 不得复述 title。

## 提交前检查（并行）

与 Cursor 内置 git-commit 提示一致，先收集再写消息：

```bash
git status
git diff
git diff --cached
git log -8 --format='%s%n%n%b%n-----'
```

- 按 **独立逻辑变更** 拆成多个原子 commit（`git add -- <paths>`）
- 默认纳入**所有**待提交变更；仅当用户明确要求时才限制路径
- 不要提交密钥、`sandbox/**` 生成态、或其它 gitignored 产物

## 消息：subject + 有信息量的 body

```
<type>(<scope>): <description>

<body>
```

**Subject**（一行，英文 Conventional Commits）：

- `type(scope):` 祈使句，约 72 字符，无句号
- 概括**这一个逻辑变更**，不要堆文件名，不要用 `and` 把两件事塞进同一行
- 对照 `git log` 的 type/scope 习惯（如 `docs(website)`、`feat(examples)`、`fix(extension)`）

**Body（默认必写）** — 对齐 Cursor 内置 commit 规则（分析 staged diff → 定性 feat/fix/docs/… → **写 why，不要只复述 what**）以及 [create-skill](/Users/a1/.cursor/skills-cursor/create-skill/SKILL.md) 的 commit 示例：body 补充 subject **没说出**的动机、约束或做法。

写 1–3 句（可换行，每行约 72 字符）：

1. **为何要改**（之前缺什么 / 错在哪 / 用户会碰到什么）
2. **怎么处理**（关键约束或取舍，不是文件清单）
3. 必要时补 **可见结果**（协议行为、站点路径、发布身份等）

**禁止：**

- 空 body（单行 typo 除外）
- 把 subject 改写一遍当 body（例如 title 已是 `rewrite the Chinese course-authoring guide`，body 再写 `Rewrite the Chinese course-authoring guide.`）
- 只罗列路径（`Update foo.md and bar.yml`）
- Cursor co-author / `Made-with: Cursor` trailer

**以本仓库 `git log` 为准**（好的写法）：

```
docs(website): rewrite the Chinese features guide with screenshots

Walk through opening a course, switching chapters, file diffs, and
reference folders instead of leaving placeholder slots.
```

```
fix(extension): publish as RuanJiazhen to match Marketplace identity

The first vsce upload used publisher rjiazhen, so LearnByDiff never
appeared under the existing RuanJiazhen publisher used by Powerful NPM Run.
```

```
feat(examples): point demo docs at the site and drop blank chapter

Use the published skeleton tutorial URL for https docs coverage.
```

差的写法（不要再生成这种只有 subject、或 body 复述 title 的消息）：

```
docs(website): rewrite the Chinese course-authoring guide
```

```
feat(auth): implement JWT-based authentication

Implement JWT-based authentication.
```

对照 create-skill 示例，body 应补具体做法：

```
feat(auth): implement JWT-based authentication

Add login endpoint and token validation middleware
```

每个 commit 用 HEREDOC；提交后检查 `git log -1 --format='%an %ae%n%B'`，去掉 Cursor trailer。全部完成后 `git status` 应干净。

## 提交之后：立即 Ship（同一次调用）

用 `gh pr view --json number,state`（或 `gh pr list --head`）判断当前分支是否已有 **OPEN PR**。

- **已有 OPEN PR**：立即 `git push`（更新同一 PR）。**禁止** `gh pr create` / merge。汇报 commit 摘要与 PR URL 后停止。
- **尚无 PR**：立刻执行 [ship.md](./ship.md) 的 Push **和** 创建 PR（两步都在本阶段做完，不要停下来等下一次 `/continue`）。

**禁止**只 commit 就结束（那会把 push / 开 PR 拆成另一次调用）。
