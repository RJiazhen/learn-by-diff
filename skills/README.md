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
   - Ordered snapshot dirs, e.g. `start,hello,world` or `intro/start,intro/hello`
   - Where to write `.course-config` and what `source.repository` should be

**Without dirs specified**, the agent **first** uses its built-in project tools (Glob / directory listing / etc.) to find chapter-like sibling folders. The script [`generate-course-config/scripts/detect-chapter-dirs.mjs`](generate-course-config/scripts/detect-chapter-dirs.mjs) is a **fallback** when those tools are missing. If nothing reliable is found, the skill **stops** and asks you for paths instead of inventing them.

```bash
# Optional: run the fallback detector yourself
node skills/generate-course-config/scripts/detect-chapter-dirs.mjs .
node skills/generate-course-config/scripts/detect-chapter-dirs.mjs --dirs start,hello,world .
```

## Protocol notes

- `course.yml` fields are all optional (`id` / `title` / `source.repository` have path-based defaults; optional `source.root`).
- Chapter fields are all optional (`id`/`title` from filename; empty `fromDir`/`toDir` = empty trees; omit `entryFiles` to auto-discover files under `toDir`).
- No `workspace`, `protocolVersion`, or `tests` fields yet (protocol only adds optional fields over time).
- Schema: [`packages/protocol/schema.json`](../packages/protocol/schema.json).
