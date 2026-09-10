---
name: continue
description: >-
  Advance LearnByDiff work one phase at a time (issue → branch → implement →
  commit → push/PR → merge). Use when the user asks to continue, ship, commit,
  open PR, or progress a feature.
---

# Continue

Repo: **`RJiazhen/learn-by-diff`** (default `main`).

1. Read [phases/detect.md](./phases/detect.md) (agent-only).
2. Detect phase → read **only** that phase file → execute → stop.
3. Never chain phases or load all phase files in one call.

## User-facing output

`phases/*` and detection details are **agent-only**. Do not paste, quote, or restate them in chat. Reply with a brief result plus the response template from `detect.md` only.
