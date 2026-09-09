---
name: create-issue
description: >-
  Creates a GitHub Issue from the user's description in RJiazhen/learn-by-diff.
  Use when the user asks to 开 issue、登记待办, or to file a bug/feature without
  implementing it.
---

# Create Issue

从**用户描述**在 **`RJiazhen/learn-by-diff`** 新建 **GitHub Issue**。本 skill **只创建 Issue**，不实现功能，不往 GitHub Project 加卡片。

## Hardcoded target

|          |                          |
| -------- | ------------------------ |
| **Repo** | `RJiazhen/learn-by-diff` |

仅当用户明确写出其它 `owner/repo` 时才改 `--repo`。

## Not this skill

| Request              | Instead     |
| -------------------- | ----------- |
| 已有 Issue，要开始做 | `/continue` |

## Workflow

```
Task Progress:
- [ ] Parse description → title, body, label
- [ ] Duplicate check
- [ ] gh issue create
- [ ] Report deliverable
```

### 1. Title, body, label

Build from the user message only. Do not invent scope, stack, or acceptance the user did not state.

**Title:** one concise line (keep the user's language). Do not prefix `Idea:`.

**Label** (one)：

| User intent          | Label           |
| -------------------- | --------------- |
| bug / 复现 / 损坏    | `bug`           |
| 文档                 | `documentation` |
| 功能 / 待办 / 未说明 | `enhancement`   |

**Body** (omit empty sections). Long bodies: write to `$(mktemp)`, then `--body-file`.

```markdown
## Description

<user facts, restructured; no extra research>

## Acceptance

- [ ] <only if the user stated checkable outcomes>

## Additional context

<env, URLs, “fix later”, related PR/issue — only if given>
```

If the message is too vague to form a title (no noun + intent), ask **one** question; do not create.

### 2. Duplicate check

```bash
gh issue list --repo RJiazhen/learn-by-diff --state open --search "<2-6 keywords>" --limit 20
```

If an OPEN issue already matches, **stop**, paste its URL, and create only if the user says to create anyway.

### 3. Create

```bash
gh issue create --repo RJiazhen/learn-by-diff \
  --title "..." \
  --body-file "$TMP" \
  --label enhancement
```

### 4. Deliverable (mandatory)

1. **Issue:** URL and number
2. **One line:** title + label

Do not output an implementation plan. Next implementation step is `/continue`.

## Do not

- Explore or change application code.
- Close, edit, or duplicate an existing Issue unless the user asks.
- Add the Issue to a GitHub Project.
- Commit, push, or open a PR.
