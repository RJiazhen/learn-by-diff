---
title: Retained files
outline: deep
---

# Retained files

When you switch chapters, source files in the learning folder are **replaced** by that chapter’s snapshot. The snapshot is copied in place, then paths that are not in the snapshot are deleted. The two chapters are not merged.

`retain` in `course.jsonc` lists **`.gitignore`-style patterns**. Matching uses the same rules as `.gitignore`, evaluated from the learning folder root:

- `node_modules` keeps every `node_modules` directory anywhere in the tree
- `/node_modules` keeps only the root `node_modules`
- `node_modules/` matches directories only
- `*.log` matches that suffix in any directory
- `!important.txt` un-ignores a path (gitignore negation)

When `retain` is omitted, `node_modules` is kept. An explicit `[]` keeps no extra project paths.

The learning copy at `.learn/course/course.jsonc` also adds `.git`, `.learn`, `.gitignore`, and `*.code-workspace`. Do not add those yourself.

The workspace `.gitignore` still tells git what not to commit. It does not decide which files stay when you switch chapters — that is only `retain`.

## Notes

- Files that are in the snapshot are still overwritten, even when a `retain` pattern matches them.
- A gitignored folder such as `dist/` is deleted unless a `retain` pattern matches it.
