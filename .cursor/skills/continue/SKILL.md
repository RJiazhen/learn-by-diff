---
name: continue
description: >-
  Advance LearnByDiff one phase at a time (issue, branch, implement, push/PR,
  merge). Use when the user asks to continue, ship, open a PR, or progress a
  feature.
---

# Continue

Repo: **`RJiazhen/learn-by-diff`** (default `main`).

1. Read [phases/detect.md](./phases/detect.md) (agent-only).
2. Detect phase → read **only** that phase file → execute → stop.
3. Never chain phases or load all phase files in one call.

After a file change, commit that logical change before starting the next one. Message format: [phases/commit.md](./phases/commit.md).

## User-facing output

`phases/*` and detection details are **agent-only**. Do not paste, quote, or restate them in chat. Reply with a brief result plus the response template from `detect.md` only.
