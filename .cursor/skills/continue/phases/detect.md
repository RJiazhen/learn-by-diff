# Continue — detection & constraints (agent-only)

Do not paste or restate this file in the user reply.

## One phase per call

- Clean tree, unpushed commits or no PR → a later call may **Ship**.
- OPEN PR, clean, synced → a later call may **Merge**.
- After the phase: stop. Do not re-detect or continue to the next phase in the same turn.
- After a file change, commit that logical change in time. Format: [commit.md](./commit.md). `git reset --soft` of an unpushed feature-branch commit is allowed only to split it into atomic commits; keep the file changes. Do not reset `main` or force-push.

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

| Condition                                      | Phase       | File                                 |
| ---------------------------------------------- | ----------- | ------------------------------------ |
| On `main`, no feature-branch context           | **Start**   | [start.md](./start.md)               |
| Feature branch, acceptance incomplete or dirty | **Develop** | [develop-wait.md](./develop-wait.md) |
| Unpushed commits or no PR yet                  | **Ship**    | [ship.md](./ship.md)                 |
| OPEN PR, clean, synced with origin             | **Merge**   | [merge.md](./merge.md)               |
| Pushed, PR open, waiting                       | **Wait**    | [develop-wait.md](./develop-wait.md) |

## Response template

```markdown
- Phase: `<Start | Develop | Ship | Merge | Wait>`
- Base branch: `<default-branch>`
- Branch: `<current-branch>`
- Requirement source: `<issue #n — title | user description>`
- Done this step: `<what was just completed>`
- Next step: `<what happens on next skill invocation or user action>`
```

## Constraints

- No develop or `--force` push on `main`. After a successful Merge, close issues the PR body links with `Closes` / `Fixes` via `gh issue close`. Do not otherwise edit issues.
- Commit: Conventional Commits, one logical change; body required (why, not a subject echo).
- Only **Merge** merges PRs. No secrets; no `sandbox/**` as source of truth—use `examples/`.
- After protocol `src` changes: `pnpm exec vp run @learn-by-diff/protocol#pack` before extension test/F5.
- Norms: [AGENTS.md](../../../../AGENTS.md), [docs/architecture.md](../../../../docs/architecture.md).
