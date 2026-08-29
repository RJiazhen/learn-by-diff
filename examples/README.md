# Example courses

[`demo-course/`](demo-course/) + [`demo-source/`](demo-source/) are a minimal local pair for Extension Development Host (F5). Both are normal committed trees — no nested git repos and no setup script.

## Source layout

Chapter snapshots live as directories **inside one source repository**. Each chapter’s `fromDir` / `toDir` are paths relative to that repo root (or optional `source.root`):

- Nested paths are allowed (`intro/start`, `advanced/start`).
- Chapters do **not** need to share a parent folder or chain `toDir` → next `fromDir`.
- Per-chapter separate git remotes are not supported (one `source.repository` per course).

The demo keeps a simple sibling layout (`start/`, `hello/`, `world/`, `bang/`) with evolving files under `src/greeting/…`. Git history-based chapter switching can come later.

**LearnByDiff: Open Course** prefills `examples/demo-course` in Development mode.

Protocol unit tests still use `packages/protocol/fixtures/`.
