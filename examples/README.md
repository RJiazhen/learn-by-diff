# Example courses

[`demo-course/`](demo-course/) + [`demo-source/`](demo-source/) are a minimal local pair for Extension Development Host (F5). Both are normal committed trees — no nested git repos and no setup script.

Source layout is **one directory per chapter** (`start/`, `hello/`, `world/`, `bang/`), each with nested evolving files under `src/greeting/…`. Chapter yaml uses `fromDir` / `toDir`. Git history-based chapter switching can come later.

**LearnByDiff: Open Course** prefills `examples/demo-course` in Development mode.

Protocol unit tests still use `packages/protocol/fixtures/`.
