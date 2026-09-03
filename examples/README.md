# Example courses

[`demo-course/`](demo-course/) + [`demo-source/`](demo-source/) are a local pair for Extension Development Host (F5). Both are normal committed trees — no nested git repos and no setup script.

## Source layout

Chapter snapshots live as directories **inside one source repository**. Each chapter’s `fromDir` / `toDir` are paths relative to that repo root (or optional `source.root`):

- Nested paths are allowed (`intro/start`, `advanced/start`).
- Chapters do **not** need to share a parent folder or chain `toDir` → next `fromDir`.
- Per-chapter separate git remotes are not supported (one `source.repository` per course).

The demo is a small visual course (`start/` → `skeleton/` → `particles/` → `follow/` → `glow/`): a canvas particle field that ends up following the cursor. Snapshot trees nest under `src/scene`, `src/particle`, and `src/pointer` so chapter diffs include new folders, not only a single `main.js`. A fifth course chapter reuses `glow` as both `fromDir` and `toDir` (no new snapshot) so `docs` can be an https URL.

**LearnByDiff: Open Course** prefills `examples/demo-course/.course-config/course.yml` in Development mode.

Protocol unit tests still use `packages/protocol/fixtures/`.
