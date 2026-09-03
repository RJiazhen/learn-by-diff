# AGENTS.md — LearnByDiff

Guidance for AI agents working in this repository. Read this first; follow linked docs for depth.

## What this is

VS Code / Cursor extension that turns a **course repo** (Learning Course Protocol: a `course.yml` file plus chapter YAML) plus a **source repo** (directory snapshots per chapter) into a local **learning workspace**. Students learn by implementing increments and comparing diffs—not by checking out git history.

Not in scope: course hosting, accounts, AI explanations of code.

## Layout

| Path                                   | Role                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| `packages/protocol`                    | LCP types, YAML parse/validate/load, `schema.json` (`@learn-by-diff/protocol`) |
| `apps/vscode-extension`                | Extension UI, git, workspace create, explorer, deep links                      |
| `examples/demo-course` + `demo-source` | Local F5 fixtures                                                              |
| `sandbox/`                             | Extension Development Host folder (generated `.learn/` gitignored)             |
| `skills/`                              | Author Agent Skills (not in pnpm workspace)                                    |
| `docs/`                                | Architecture                                                                   |

## Commands

```bash
pnpm install
pnpm exec vp check
pnpm exec vp run -r test
pnpm exec vp run @learn-by-diff/protocol#pack   # required after protocol src changes
pnpm exec vp run learn-by-diff#pack
```

F5 → packs with watch → opens `sandbox/`. Reload Extension Host after code changes.

## Hard product rules (current + direction)

- Protocol evolves **additively** (optional fields only). No `protocolVersion` gate. No `workspace.*` / chapter `tests` yet.
- Course + chapter YAML: **all fields optional** with path/filename defaults (see protocol types / `docs/architecture.md`). Optional `chaptersDir` defaults to `chapters` next to `course.yml`.
- Prefer **reference via diff** for learning; workspace overwrite is explicit **Chapter Start** / **Chapter Finish** (dirty confirm vs last applied snapshot).
- One `source.repository` per course; optional `source.root`. No per-chapter remotes.
- Open Course takes a **`course.yml` file path** (or a git URL to clone). Do not pass a directory that might contain config.
- Schema for authors: `# yaml-language-server: $schema=…/schema.json#/$defs/course|chapter` (relative path). Do not rely on workspace `yaml.schemas`.

## Code norms

- Every **function / method / named closure** needs an idiomatic doc comment stating what it does (not just the name).
- Match existing naming, imports, formatting; run `vp check` (oxc). Do not reformat unrelated files.
- Extension depends on **packed** protocol (`dist/`); rebuild protocol before extension tests if you changed it.
- Commits: Conventional Commits, **one logical change per commit** (use `/conventional-commit` skill when asked).

## Where to change what

| Task                                    | Start here                                           |
| --------------------------------------- | ---------------------------------------------------- |
| Course/chapter YAML shape               | `packages/protocol` + `schema.json` + fixtures/tests |
| Open course / chapter switch / `.learn` | `apps/vscode-extension/src/workspace/`               |
| Explorer / docs button / diffs          | `apps/vscode-extension/src/ui/`                      |
| `vscode://` / `cursor://` links         | `apps/vscode-extension/src/uri/` + `onUri`           |
| Author scaffolding skill                | `skills/generate-course-config/`                     |

## Deeper reading

- [`docs/architecture.md`](docs/architecture.md) — runtime model, package boundaries, dev loop
- [`README.md`](README.md) — human overview, publish, deep-link examples
- Cursor rules under [`.cursor/rules/`](.cursor/rules/) — scoped conventions while editing
