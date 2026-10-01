---
title: Author a course
outline: deep
---

# Author a course

A course is config plus source snapshots. Students paste the course config URL to open it.

## Scaffold quickly

If you are not sure what to put in the config files, use the bundled Skill to generate them.

Install the [course generator Skill](https://github.com/RJiazhen/learn-by-diff/tree/main/skills/generate-course-config.md):

```bash
npx skills add RJiazhen/learn-by-diff@generate-course-config -y
```

Then run `/generate-course-config` in the directory that holds the source snapshots.

You can also pass a GitHub repository URL; the agent will read the source and generate the config.

## Course config files

Every course needs a `course.jsonc` and chapter files `chapters/*.jsonc`.

### course.jsonc

Create `course.jsonc` in your course repository and paste:

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/RJiazhen/learn-by-diff/refs/heads/main/packages/protocol/schema.json#/$defs/course",
  "id": "demo-course",
  "title": "Demo course",
  "source": {
    "repository": "https://github.com/RJiazhen/learn-by-diff.git",
    "root": "examples/demo-source",
  },
  "chaptersDir": "chapters",
}
```

Fields in `course.jsonc`:

- `id` (optional): Stable course id, also used as the student workspace folder name. Prefer a path-safe slug (letters, digits, hyphens). If omitted, the course folder name is used; if that folder is a git repository root, `{repo-name}-learn`.
- `title` (optional): Human-readable display name. Defaults to `id`.
- `source.repository` (optional): Where the source lives. Three forms:
  - Git repository URL, for example `https://github.com/org/repo.git`.
  - Local path: absolute, or relative to the directory that contains `course.jsonc`.
  - Omitted: source is the directory that contains `course.jsonc`.
- `source.root` (optional): Path of the source tree inside `source.repository`. Omitted means the repository root.
- `chaptersDir` (optional): Directory of chapter JSONC files, relative to `course.jsonc`. Defaults to `chapters` next to `course.jsonc`.
- `retain` (optional): `.gitignore`-style patterns for paths that stay when a chapter snapshot is applied. Matching uses gitignore rules from the learning folder root (`node_modules` keeps every `node_modules` directory). Omitted means `node_modules`. `[]` keeps no extra project paths. The workspace `.gitignore` does not control this. See [Retained files](../course-config/retained).

### chapters/*.jsonc

Next to `course.jsonc`, create a `chapters` directory, then create `00-start.jsonc` and paste:

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/RJiazhen/learn-by-diff/refs/heads/main/packages/protocol/schema.json#/$defs/chapter",
  "id": "start",
  "title": "Start",
  "fromDir": "start",
  "toDir": "skeleton",
  "entryFiles": ["src/main.js"],
  "docs": "README.md",
}
```

Chapter files go in `chaptersDir` (default `chapters/` next to `course.jsonc`).

Each `.jsonc` file is one chapter. **Course order matches filename order**, so prefix names with numbers such as `00-start.jsonc`, `01-skeleton.jsonc`.

If `id` is empty, it is derived by stripping the extension and a leading numeric prefix: `00-start.jsonc` → `start`. Prefixes like `00-`, `01_`, and `1.` work. A course needs at least one chapter file, and chapter ids must be unique.

Fields in each chapter file:

- `id` (optional): Stable chapter id used for progress, not for display. Omitted or empty → derived from the filename (`00-start.jsonc` → `start`).
- `title` (optional): Display name. Omitted or empty → `id`.
- `fromDir` (optional): Start snapshot directory, relative to `source.repository` (or to `source.root` when that is set). Empty means an empty tree. No `..` or absolute paths.
- `toDir` (optional): Goal snapshot directory; same path rules as `fromDir`. Empty means an empty tree.
- `entryFiles` (optional): Files to highlight, relative to the chapter snapshot tree (`toDir`). Omitted means every file under `toDir`.
- `changedFiles` (optional): From/to diffs (`path` plus `U` added, `M` modified, `D` deleted). Open Course uses this instead of comparing snapshots. Omitted means classify at runtime. An empty list means the chapter did not change. The generate-course-config skill fills this when scaffolding.
- `docs` (optional): Chapter documentation: an `http(s)` URL, or a file path in the snapshot tree (`toDir` first, then `fromDir`), for example `README.md`. Omitted means no docs button.

### Retained files

When you switch chapters, `.gitignore`-style `retain` patterns stay in the learning folder. Omitted `retain` keeps every `node_modules`. See [Retained files](../course-config/retained).

## Share a course

Follow these steps to share a finished course.

### Push the course repository to Git

Publish the course repository (including the source) to Git.

### Share the config location

If the course is on GitHub, you can share the `course.jsonc` file URL. The other person pastes it into Open Course.

For example:

```text
https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.jsonc
```

If `course.jsonc` is at the repository root, or at `.course-config/course.jsonc` under the root, you can share the git repository URL instead:

```text
https://github.com/RJiazhen/learn-by-diff.git
```

If `course.jsonc` lives in a subdirectory, append `#` and the path relative to the repository root (pointing at `course.jsonc`):

```text
https://github.com/RJiazhen/learn-by-diff.git#examples/demo-course/.course-config/course.jsonc
```

### One-click share links

Or turn that address into a one-click link. Clicking it wakes the IDE and opens the course:

```text
vscode://RuanJiazhen.learn-by-diff/open?url=<course.jsonc-or-git-repo-URL>
cursor://RuanJiazhen.learn-by-diff/open?url=<course.jsonc-or-git-repo-URL>
```

Use `vscode://` for VS Code and `cursor://` for Cursor. The other person needs LearnByDiff installed; the OS may ask once for permission to open the protocol.

Example for `https://github.com/RJiazhen/learn-by-diff.git`:

```text
vscode://RuanJiazhen.learn-by-diff/open?url=https://github.com/RJiazhen/learn-by-diff.git
cursor://RuanJiazhen.learn-by-diff/open?url=https://github.com/RJiazhen/learn-by-diff.git
```
