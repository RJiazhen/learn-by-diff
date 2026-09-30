# Skills

Agent skills for LearnByDiff course authors. They are **not** part of the pnpm workspace.

| Skill                    | Path                                                 | Purpose                                                     |
| ------------------------ | ---------------------------------------------------- | ----------------------------------------------------------- |
| `generate-course-config` | [`generate-course-config/`](generate-course-config/) | Scaffold `.course-config` from chapter snapshot directories |

## Install

Requires [Cursor](https://cursor.com/) 2.4+ (or another agent that supports [Agent Skills](https://skills.sh/)) and Node.js/`npx`.

From any machine:

```bash
# Project-scoped (run inside the repo that should get the skill)
npx skills add RJiazhen/learn-by-diff@generate-course-config -y

# Global (user-level)
npx skills add RJiazhen/learn-by-diff@generate-course-config -g -y

# Explicit Cursor agent target (when multiple agents are installed)
npx skills add RJiazhen/learn-by-diff@generate-course-config --agent cursor -y
```

After install, start a **new** Agent chat. Invoke with `/generate-course-config` or ask to “generate LearnByDiff course config”.

### Local path (this monorepo)

No install needed while developing the skill in-tree: open this repository in Cursor and reference `skills/generate-course-config`.

Manual copy:

```bash
cp -R skills/generate-course-config ~/.cursor/skills/generate-course-config
# or project: .cursor/skills/generate-course-config
```

## Use

1. Open the **source** repository (or a monorepo that contains snapshot folders).
2. Run the skill.
3. Optional arguments you can give the agent:
   - Source root (default: current workspace)
   - Chapter `fromDir` / `toDir` pairs (need not be consecutive snapshots)
   - Where to write `.course-config` and what `source.repository` should be

The agent **writes** basic `chapters/*.jsonc`, then **runs** [`generate-course-config/scripts/detect-chapter-dirs.mjs`](generate-course-config/scripts/detect-chapter-dirs.mjs) so it **fills** `changedFiles` (`--out`, `--depth`). Stdout is `{ok,wrote,failed}` plus `result` only on failure. `detect-chapter-dirs.result.json` lists **failures only** (read it when `ok` is false, then **delete** it). One chapter failure does not stop the rest. If Node is missing, it implements the same filler locally — it does not paste compare results into the chat.

```bash
node skills/generate-course-config/scripts/detect-chapter-dirs.mjs --out .course-config .
node skills/generate-course-config/scripts/detect-chapter-dirs.mjs --out .course-config --depth 8 .
```

After files are written, the agent should print:

- The **absolute `course.jsonc` path** to paste into **Open Course**
- Local try-open links:

```text
vscode://RuanJiazhen.learn-by-diff/open?url=<urlencoded-absolute-course.jsonc>
cursor://RuanJiazhen.learn-by-diff/open?url=<urlencoded-absolute-course.jsonc>
```

## Protocol notes

- `course.jsonc` fields are all optional (`id` / `title` / `source.repository` have path-based defaults; omitted `source.repository` is the directory that contains `course.jsonc`; optional `source.root` and `chaptersDir`, which defaults to `chapters` next to `course.jsonc`).
- Chapter fields are all optional (`id`/`title` from filename; empty `fromDir`/`toDir` = empty trees; omit `entryFiles` to auto-discover files under `toDir`; optional `changedFiles` path + U/M/D; optional `docs` URL or relative doc path).
- No `workspace`, `protocolVersion`, or `tests` fields yet (protocol only adds optional fields over time).
- Schema: [`packages/protocol/schema.json`](../packages/protocol/schema.json).
