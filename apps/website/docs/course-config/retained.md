---
title: Retained files
outline: deep
---

# Retained files

When you switch chapters, source files in the learning folder are **replaced** by that chapter’s snapshot. The two chapters are not merged.

With no extra config, everything except `.git` and `.learn` is **deleted**, then the snapshot is written.

To keep files you need for development (for example `node_modules/`), list them in `.gitignore`. Those ignored files and folders are not deleted.

## Notes

- Only **top-level** ignored paths are kept. Ignoring `node_modules/` keeps the root `node_modules/` folder. Ignoring `src/generated/` still replaces the whole `src` tree when you switch chapters.
- Source files that are not ignored by `.gitignore` are still overwritten by the snapshot.
