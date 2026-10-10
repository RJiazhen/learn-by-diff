# Commit

Use this immediately after one logical file change. Do not push or open a PR from here.

`git reset --soft HEAD~1` (or `HEAD~N` for only the commits being split) is allowed on an unpushed feature-branch commit when that commit mixed two logical changes. Keep the file changes, then commit each change separately. Do not `git reset --hard`, reset `main`, or force-push.

## Before writing the message

```bash
git status
git diff
git diff --cached
git log -8 --format='%s%n%n%b%n-----'
```

Stage only that change (`git add -- <paths>`). No secrets, no `sandbox/**`.

## Message

```
<type>(<scope>): <imperative summary>

<body>
```

- Subject: English Conventional Commits, ~72 characters, no period. One change; no file list; no `and` joining two changes. Match `git log` scopes (`docs(website)`, `fix(extension)`, `feat(examples)`).
- Body: 1–3 sentences on why and the constraint, not a restatement of the subject. No Cursor co-author trailer.

```
docs(website): rewrite the Chinese features guide with screenshots

Walk through opening a course, switching chapters, file diffs, and
reference folders instead of leaving placeholder slots.
```

Pass the message with a HEREDOC. After commit, check `git log -1 --format='%an %ae%n%B'`. If a hook re-adds a Cursor trailer, do not recommit with `--no-verify`.
