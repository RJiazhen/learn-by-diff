# LearnByDiff

VS Code / Cursor extension that turns a GitHub **course repository** (Learning Course Protocol) plus a **source repository** into a real local learning workspace. You learn by implementing **feature increments**, not by reverse-engineering the final tree.

This repo is a pnpm + [Vite+](https://viteplus.dev/) monorepo. It does not host courses, user accounts, or AI explanations.

## Packages

| Path                                             | Role                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| [`packages/protocol`](packages/protocol)         | LCP types, YAML parse, validation (`@learn-by-diff/protocol`)          |
| [`apps/vscode-extension`](apps/vscode-extension) | VS Code extension (`learn-by-diff`)                                    |
| [`sandbox/`](sandbox)                            | F5 debug workspace (generated files are gitignored)                    |
| [`skills/`](skills), [`examples/`](examples)     | Author skills (course scaffolding); committed local demo course/source |

## Develop

Requires Node 22+, pnpm, Git, and the `vp` CLI from Vite+ (or use `pnpm exec vp`).

```bash
pnpm install
pnpm exec vp check
pnpm exec vp run -r test
pnpm exec vp run @learn-by-diff/protocol#pack
pnpm exec vp run learn-by-diff#pack
```

Press **F5** (`Run Extension`). The prelaunch task runs `vp pack --watch`, then the Extension Development Host opens [`sandbox/`](sandbox) with **other extensions disabled**. After code changes, reload the Extension Development Host window to pick up the rebuilt bundle. **LearnByDiff: Open Course** prefills [`examples/demo-course`](examples/demo-course).

Real users pick a parent folder; the workspace is created as `{parent}/{course.id}/`.

## Course protocol (LCP)

Course repos need:

```text
.course-config/course.yml
.course-config/chapters/*.yml
```

`course.yml` fields are all optional: `id` defaults from the `.course-config` parent (or `{repo}-learn` at a git root), `title` defaults to `id`, `source.repository` defaults to `.` (the course home). Optional `source.root` prefixes chapter dirs. Chapter YAML fields are all optional: `id`/`title` default from the filename, empty `fromDir`/`toDir` mean empty trees, omitted `entryFiles` auto-discovers all files under `toDir`, optional `docs` is an http(s) URL or a relative doc path under the chapter snapshot. Nested paths and unrelated parents in the same repo are supported; separate remotes per chapter are not.

Authoring: JSON Schema lives at [`packages/protocol/schema.json`](packages/protocol/schema.json). Point YAML files at it with a top comment, e.g. `# yaml-language-server: $schema=../../../packages/protocol/schema.json#/$defs/course`. Runtime validation still uses `@learn-by-diff/protocol`.

### Author skills

Scaffold `.course-config` from chapter snapshot folders with the `generate-course-config` skill:

```bash
npx skills add RJiazhen/learn-by-diff@generate-course-config -y
```

Then open an Agent chat and run `/generate-course-config` (or ask to generate course config). Without explicit directories, the skill tries to detect `start` / `step-N`-style siblings; if detection fails it asks you for paths. Details: [`skills/README.md`](skills/README.md).

Learning workspaces created by the extension use `.learn/` (progress, source mirror, config copy). Opening a course repo to edit config does not restore a learning session.

## Publish

Push an annotated tag `vX.Y.Z` matching [`apps/vscode-extension/package.json`](apps/vscode-extension/package.json) `version`. GitHub Actions packages one VSIX and publishes it to:

- Visual Studio Marketplace (`VSCE_PAT`)
- Open VSX (`OVSX_PAT`)

`publisher` is `rjiazhen`; the Open VSX namespace must match. Both secrets are required; the job fails if either is missing.

Do not use local `vsce publish` as the release path. `vsce package` is fine for a local preview.
