---
title: Get started
outline: deep
---

# Get started

## Install

LearnByDiff works in **VS Code**, **Cursor**, and other VS Code-based IDEs.

Search for **LearnByDiff** in the Extensions view, or open the matching marketplace:

- [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=RuanJiazhen.learn-by-diff) (VS Code)
- [Open VSX](https://open-vsx.org/extension/RuanJiazhen/learn-by-diff) (Cursor and other Open VSX-based IDEs)

You can also [install a `.vsix` manually](https://github.com/RJiazhen/learn-by-diff/releases/tag/v0.1.0): download it from the release page and drop it into the Extensions view.

## Open a course

Click **Open Course** on the **LEARN BY DIFF** view title bar in Explorer (or run **LearnByDiff: Open Course** from the Command Palette).

<img src="../images/open-course-button.png" alt="Open Course button" style="height: 300px; width: auto; margin: 0 auto;" />

Paste this demo course config URL and confirm:

```text
https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.yml
```

In the folder picker, choose a directory for the learning workspace. Course files download into that folder.

<image src="../images/demo-course-screenshot.png" alt="demo course screenshot" style="height: 500px; width: auto; margin: 0 auto;" />

> Layout of the learning workspace after download

You can also open the demo in one click:

- [VS Code](vscode://RuanJiazhen.learn-by-diff/open?url=https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.yml)
- [Cursor](cursor://RuanJiazhen.learn-by-diff/open?url=https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.yml)

## Learn in your own way

The first time you open a course, chapter 1’s start snapshot is exported locally.

For the demo course, preview `index.html` with the [Live Preview](https://marketplace.visualstudio.com/items?itemName=ms-vscode.live-server) extension.

Click **Completed** on a chapter to replace the local tree with that chapter’s finish snapshot and preview the result.

<video class="lbd-loop-video" src="../video/change-chapter.mp4" autoplay muted loop playsinline></video>

You can also open the chapter **docs** to read the goals and walkthrough.

<video class="lbd-loop-video" src="../video/open-documents.mp4" autoplay muted loop playsinline></video>

Or click a file under the chapter to see the code that reaches the goal.

<video class="lbd-loop-video" src="../video/open-file.mp4" autoplay muted loop playsinline></video>

For opening a single chapter folder to compare, switching back to Not Started, and more, see [Features](/intro/features).
