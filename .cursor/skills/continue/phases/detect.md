# Continue — detection & constraints (agent-only)

Do not paste or restate this file in the user reply.

## One phase per call

- Uncommitted changes → **Commit** only (no push / no PR).
- Clean tree → later call may **Ship** (push; create PR if none open).
- OPEN PR, clean, synced → later call may **Merge** (user approval implied).
- After the phase: stop. Do not re-detect or continue to the next phase in the same turn.

## Phase detection (run first)

```bash
git branch --show-current
git status --short
git diff --cached --quiet; echo "staged_exit:$?"
git symbolic-ref refs/remotes/origin/HEAD
git fetch origin
gh pr view --json number,state,url 2>/dev/null || gh pr list --head "$(git branch --show-current)" --json number,state,url --limit 1
```

First match wins:

| Condition                             | Phase       | File                                 |
| ------------------------------------- | ----------- | ------------------------------------ |
| On `main`, no feature-branch context  | **Start**   | [start.md](./start.md)               |
| Feature branch, acceptance incomplete | **Develop** | [develop-wait.md](./develop-wait.md) |
| Dirty worktree / index                | **Commit**  | [commit.md](./commit.md)             |
| Unpushed commits or no PR yet         | **Ship**    | [ship.md](./ship.md)                 |
| OPEN PR, clean, synced with origin    | **Merge**   | [merge.md](./merge.md)               |
| Pushed, PR open, waiting              | **Wait**    | [develop-wait.md](./develop-wait.md) |

## Response template

```markdown
- Phase: `<Start | Develop | Commit | Ship | Merge | Wait>`
- Base branch: `<default-branch>`
- Branch: `<current-branch>`
- Requirement source: `<issue #n — title | user description>`
- Done this step: `<what was just completed>`
- Next step: `<what happens on next skill invocation or user action>`
```

## Constraints

- No develop or `--force` push on `main`. Issues read-only (except PR `Closes`/`Fixes` after merge).
- Commit: Conventional Commits, one logical change; body required (why/constraints, not subject echo).
- Only **Merge** merges PRs. No secrets; no `sandbox/**` as source of truth—use `examples/`.
- After protocol `src` changes: `pnpm exec vp run @learn-by-diff/protocol#pack` before extension test/F5.
- Norms: [AGENTS.md](../../../../AGENTS.md), [docs/architecture.md](../../../../docs/architecture.md).
