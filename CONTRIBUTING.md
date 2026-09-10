# Contributing to LearnByDiff

Thanks for contributing. This repo is a pnpm + [Vite+](https://viteplus.dev/) monorepo. Agents and humans should start with [`AGENTS.md`](AGENTS.md); architecture detail lives in [`docs/architecture.md`](docs/architecture.md).

## Setup

Requires Node 22+, pnpm, Git, and the `vp` CLI from Vite+ (or use `pnpm exec vp`).

```bash
pnpm install
git config core.hooksPath .githooks
pnpm exec vp check
pnpm exec vp run -r test
pnpm exec vp run @learn-by-diff/protocol#pack
pnpm exec vp run learn-by-diff#pack
pnpm --filter website dev
```

Press **F5** (`Run Extension`). The prelaunch task runs `vp pack --watch`, then the Extension Development Host opens [`sandbox/`](sandbox) in a temporary empty profile. After code changes, reload the Extension Development Host to pick up the rebuilt bundle. **LearnByDiff: Open Course** prefills [`examples/demo-course/.course-config/course.yml`](examples/demo-course/.course-config/course.yml).

## Layout

| Path                                             | Role                                                          |
| ------------------------------------------------ | ------------------------------------------------------------- |
| [`packages/protocol`](packages/protocol)         | LCP types, YAML parse, validation (`@learn-by-diff/protocol`) |
| [`apps/vscode-extension`](apps/vscode-extension) | VS Code extension (`learn-by-diff`)                           |
| [`apps/website`](apps/website)                   | Project site (VitePress, GitHub Pages)                        |
| [`sandbox/`](sandbox)                            | F5 debug workspace (generated files are gitignored)           |
| [`skills/`](skills), [`examples/`](examples)     | Author skills; committed local demo course/source             |

## Pull requests

- Prefer Conventional Commits, **one logical change per commit**.
- After protocol `src` edits, run `pnpm exec vp run @learn-by-diff/protocol#pack` before extension tests or F5.
- Do not commit secrets. Do not treat `sandbox/**` generated state as source of truth—use `examples/`.
- Match existing naming, imports, and formatting; run `pnpm exec vp check`.
- Every function / method / named closure needs an idiomatic doc comment stating what it does.

## Publish (maintainers)

Bump `version` in [`apps/vscode-extension/package.json`](apps/vscode-extension/package.json) and push that commit. With `core.hooksPath` set to `.githooks`, the `pre-push` hook creates and pushes annotated tag `vX.Y.Z` matching that field. You can still push the tag yourself. GitHub Actions then copies root [`README.md`](README.md) into the extension folder, packages one VSIX, and publishes it to:

- Visual Studio Marketplace (`VSCE_PAT`)
- Open VSX (`OVSX_PAT`)

`publisher` is `RuanJiazhen`. Both secrets are required; the job fails if either is missing.

Do not use local `vsce publish` as the release path. `vsce package` is fine for a local preview (`vscode:prepublish` copies the English README then packs).

## Deeper reading

- [`AGENTS.md`](AGENTS.md) — agent/developer entry
- [`docs/architecture.md`](docs/architecture.md) — runtime model and package boundaries
- [`skills/README.md`](skills/README.md) — author skill install/use
