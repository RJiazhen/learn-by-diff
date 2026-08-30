# Architecture & development process

Companion to [`AGENTS.md`](../AGENTS.md). Describes how LearnByDiff is structured today and how we have been evolving it.

## Problem model

1. **Course repository** — declares pedagogy in `.course-config/` (not the student’s full solution tree).
2. **Source repository** — holds **directory snapshots** (`fromDir` → `toDir` per chapter), optionally under `source.root`.
3. **Learning workspace** — student folder created by the extension; owns `.learn/` runtime state and the editable working tree.

Learning is driven by **snapshot diffs**, not `git checkout` of chapter history.

## Monorepo boundaries

```text
course.yml / chapters/*.yml
        │
        ▼
@learn-by-diff/protocol   parse → defaults → validate → Course
        │
        ▼
learn-by-diff extension   clone/mirror source → export trees → UI / URI
```

- **Protocol** has no VS Code or git dependency. Safe for skills, CI, and schema consumers.
- **Extension** owns git CLI, filesystem materialization, TreeView, commands, URI handler.
- After changing protocol `src/`, always `vp run @learn-by-diff/protocol#pack` before extension tests or F5.

## Learning Course Protocol (LCP) today

### On disk

```text
.course-config/course.yml
.course-config/chapters/001-*.yml   # sort order = course order
```

### `course.yml` (all optional)

| Field               | Default                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| `id`                | Parent of `.course-config`; `{repo}-learn` if that parent is a git root |
| `title`             | `id`                                                                    |
| `source.repository` | `.` (course home)                                                       |
| `source.root`       | none                                                                    |

No `protocolVersion`, no `workspace` block.

### Chapter YAML (all optional)

| Field               | Default                                                                             |
| ------------------- | ----------------------------------------------------------------------------------- |
| `id`                | Filename without numeric prefix                                                     |
| `title`             | `id`                                                                                |
| `fromDir` / `toDir` | `""` (empty tree)                                                                   |
| `entryFiles`        | Discover all files under `toDir` at runtime                                         |
| `docs`              | none — `http(s)` URL or path relative to chapter snapshot (`toDir`, then `fromDir`) |

Wire editors with:

```yaml
# yaml-language-server: $schema=<rel>/packages/protocol/schema.json#/$defs/chapter
```

## Extension runtime (`.learn/`)

Under a learning workspace root:

| Path                          | Purpose                                       |
| ----------------------------- | --------------------------------------------- |
| `.learn/progress.json`        | Applied chapter id / start or finish snapshot |
| `.learn/course/`              | Copy of course config                         |
| `.learn/source.git/`          | Materialized source store (mirror)            |
| `.learn/snapshots/<chapter>/` | Cached from/to trees when needed              |

Activation today: `onUri` + `onView:learnByDiff.courseView` + `workspaceContains:.learn/progress.json`. Explorer view **Learn By Diff** is always shown; `viewsWelcome` + Open Course in the view title when the folder is not a learning workspace.

**Not Started** / **Completed** export that chapter’s `fromDir` or `toDir` into the student tree and mark the row with that status (QuickPick only when the tree differs from the last applied snapshot). Title-bar prev/next apply the adjacent chapter’s start. First open still exports chapter one’s `fromDir`.

## Major surfaces

| Area                         | Responsibility                                                       |
| ---------------------------- | -------------------------------------------------------------------- |
| `workspace/openCourse.ts`    | Shared open-course flow (command + deep link)                        |
| `workspace/creator.ts`       | Create learning root, copy config, materialize source, first chapter |
| `workspace/session.ts`       | Chapter navigation helpers                                           |
| `ui/explorerView.ts`         | SCM-like chapter/file tree, contextValues, inline actions            |
| `ui/diff.ts` / `openDocs.ts` | File diffs; docs URL / Markdown preview / open file                  |
| `uri/*`                      | `vscode://rjiazhen.learn-by-diff/open?url=…` (also `cursor://`)      |

Deep link authority = `publisher.name` → `rjiazhen.learn-by-diff`.

## Development loop (as practiced)

1. Change protocol and/or extension; keep doc comments on every function.
2. `vp check` + package tests; pack protocol if needed.
3. F5 against `sandbox/` + `examples/demo-*`; reload host after rebuild.
4. Update `schema.json`, fixtures, demo YAML, and skill docs when the protocol surface changes.
5. Commit with Conventional Commits, **split by logical change** (protocol → extension → examples → docs).

## Author skills

`skills/generate-course-config` scaffolds `.course-config` from snapshot dirs. Not part of pnpm. After generate, print a local try-open deep link and the absolute course path.

## Examples

- `examples/demo-course` — course config (relative `../demo-source`, chapter `docs` samples: Markdown, PDF, and an https URL).
- `examples/demo-source` — `start` / `skeleton` / `particles` / `follow` / `glow` snapshots (canvas particles that follow the cursor).

## Related docs

- Human README: [`../README.md`](../README.md)
- Skill install/use: [`../skills/README.md`](../skills/README.md)
