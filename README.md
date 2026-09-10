[简体中文](docs/README.zh-cn.md) | [English](README.md) | [繁體中文](docs/README.zh-tw.md) | [日本語](docs/README.ja.md)

# LearnByDiff

Learn course source code through diffs—without losing track of what changed while you follow along.

Full docs and demo videos: [rjiazhen.github.io/learn-by-diff](https://rjiazhen.github.io/learn-by-diff/).

## Install

Search for **LearnByDiff** in the Extensions view, or open the matching marketplace:

- [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=RuanJiazhen.learn-by-diff) (VS Code)
- [Open VSX](https://open-vsx.org/extension/RuanJiazhen/learn-by-diff) (Cursor and other Open VSX-based IDEs)

You can also [install a `.vsix` manually](https://github.com/RJiazhen/learn-by-diff/releases/latest): download it from the release page and drop it into the Extensions view.

## Open a course

Click **Open Course** on the **LEARN BY DIFF** view title bar in Explorer (or run **LearnByDiff: Open Course** from the Command Palette).

<img src="https://raw.githubusercontent.com/RJiazhen/learn-by-diff/main/apps/website/docs/images/open-course-button.png" alt="Open Course button" style="max-width: 300px; display: block; margin: 0 auto;">

Paste this demo course config URL and confirm:

```text
https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.yml
```

In the folder picker, choose a directory for the learning workspace. Course files download into that folder.

Learning workspace after download:

<img src="https://raw.githubusercontent.com/RJiazhen/learn-by-diff/main/apps/website/docs/images/demo-course-screenshot.png" alt="Learning workspace after download" style="max-width: 300px; display: block; margin: 0 auto;">

With the extension installed, you can also open the demo in one click:

- [VS Code](vscode://RuanJiazhen.learn-by-diff/open?url=https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.yml)
- [Cursor](cursor://RuanJiazhen.learn-by-diff/open?url=https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.yml)

## Learn in your own way

The first time you open a course, chapter 1’s **Not Started** snapshot is exported locally. For the demo course, preview `index.html` with [Live Preview](https://marketplace.visualstudio.com/items?itemName=ms-vscode.live-server).

The Learn By Diff view lists chapters and provides:

| Action                      | What it does                                                   |
| --------------------------- | -------------------------------------------------------------- |
| **Previous / Next chapter** | Switch to the adjacent chapter’s Not Started snapshot          |
| **Open chapter docs**       | Open this chapter’s documentation                              |
| **Not Started**             | Apply this chapter’s start snapshot                            |
| **Completed**               | Apply this chapter’s finish snapshot                           |
| **Open Not Started folder** | Add this chapter’s start snapshot as its own workspace folder  |
| **Open Completed folder**   | Add this chapter’s finish snapshot as its own workspace folder |

You can edit the code anytime to see how changes affect behavior.

You can also expand a chapter to inspect the diffs that implement each feature.

More on the website: [Features](https://rjiazhen.github.io/learn-by-diff/intro/features.html).

## Contributing

See the [contributing guide](CONTRIBUTING.md).
