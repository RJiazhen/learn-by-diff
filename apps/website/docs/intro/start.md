---
title: Get started
outline: deep
---

<script setup>
import DocImage from "../.vitepress/theme/DocImage.vue";
import LoopVideo from "../.vitepress/theme/LoopVideo.vue";
</script>

# Get started

## Install

LearnByDiff works in **VS Code**, **Cursor**, and other VS Code-based IDEs.

Search for **LearnByDiff** in the Extensions view, or open the matching marketplace:

- [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=RuanJiazhen.learn-by-diff) (VS Code)
- [Open VSX](https://open-vsx.org/extension/RuanJiazhen/learn-by-diff) (Cursor and other Open VSX-based IDEs)

You can also [install a `.vsix` manually](https://github.com/RJiazhen/learn-by-diff/releases/tag/v0.1.0): download it from the release page and drop it into the Extensions view.

## Open a course

Click **Open Course** on the **LEARN BY DIFF** view title bar in Explorer (or run **LearnByDiff: Open Course** from the Command Palette).

<DocImage src="../images/open-course-button.png" alt="Open Course button" />

<LoopVideo src="../video/open-course.mp4" />

Select an official course, or paste this demo course config URL and confirm:

```text
https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.jsonc
```

In the folder picker, choose a directory for the learning workspace. Course files download into that folder.

<DocImage src="../images/demo-course-screenshot.png" alt="demo course screenshot" />

> Layout of the learning workspace after download

You can also open the demo in one click:

- [VS Code](vscode://RuanJiazhen.learn-by-diff/open?url=https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.jsonc)
- [Cursor](cursor://RuanJiazhen.learn-by-diff/open?url=https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.jsonc)

## Learn in your own way

The first time you open a course, chapter 1’s start snapshot is exported locally.

For the demo course, preview `index.html` with the [Live Preview](https://marketplace.visualstudio.com/items?itemName=ms-vscode.live-server) extension.

Click **Completed** on a chapter to replace the local tree with that chapter’s finish snapshot and preview the result.

<LoopVideo src="../video/change-chapter.mp4" />

You can also open the chapter **docs** to read the goals and walkthrough.

<LoopVideo src="../video/open-documents.mp4" />

Or click a file under the chapter to see the code that reaches the goal.

<LoopVideo src="../video/open-files.mp4" />

For opening a single chapter folder to compare, switching back to Not Started, and more, see [Features](/intro/features).
