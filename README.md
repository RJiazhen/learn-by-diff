# LearnByDiff

VS Code / Cursor extension that turns a GitHub **course repository** (Learning Course Protocol) plus a **source repository** into a real local learning workspace. You learn by implementing **feature increments**, not by reverse-engineering the final tree.

This repo is a pnpm + [Vite+](https://viteplus.dev/) monorepo. It does not host courses, user accounts, or AI explanations.

## Packages

| Path                                             | Role                                                          |
| ------------------------------------------------ | ------------------------------------------------------------- |
| [`packages/protocol`](packages/protocol)         | LCP types, YAML parse, validation (`@learn-by-diff/protocol`) |
| [`apps/vscode-extension`](apps/vscode-extension) | VS Code extension (`learn-by-diff`)                           |
| [`sandbox/`](sandbox)                            | F5 debug workspace (generated files are gitignored)           |
| [`skills/`](skills), [`examples/`](examples)     | Placeholders for later author skills and sample courses       |

## Develop

Requires Node 22+, pnpm, Git, and the `vp` CLI from Vite+ (or use `pnpm exec vp`).

```bash
pnpm install
pnpm exec vp check
pnpm exec vp run -r test
pnpm exec vp run @learn-by-diff/protocol#pack
pnpm exec vp run learn-by-diff#pack
```

Press **F5** (`Run Extension`). The Extension Development Host opens [`sandbox/`](sandbox). Run **LearnByDiff: Open Course**, paste a course git URL. If the folder is still only this README, the learning repo is created **in place**.

Real users pick a parent folder; the workspace is created as `{parent}/{course.id}/`.

## Course protocol (LCP)

Course repos need:

```text
.course-config/course.yml
.course-config/chapters/*.yml
```

Learning workspaces created by the extension use `.learn/` (progress, source mirror, config copy). Opening a course repo to edit config does not restore a learning session.

## Publish

Push an annotated tag `vX.Y.Z` matching [`apps/vscode-extension/package.json`](apps/vscode-extension/package.json) `version`. GitHub Actions packages one VSIX and publishes it to:

- Visual Studio Marketplace (`VSCE_PAT`)
- Open VSX (`OVSX_PAT`)

`publisher` is `rjiazhen`; the Open VSX namespace must match. Both secrets are required; the job fails if either is missing.

Do not use local `vsce publish` as the release path. `vsce package` is fine for a local preview.
