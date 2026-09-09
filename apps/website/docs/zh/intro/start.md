---
title: 开始
outline: deep
---

# 开始

## 安装

LearnByDiff 适用于 **VS Code**、**Cursor**，以及其他基于 VS Code 的 IDE。

在扩展视图搜索 **LearnByDiff**，或打开对应商店：

- [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=RuanJiazhen.learn-by-diff)（VS Code）
- [Open VSX](https://open-vsx.org/extension/RuanJiazhen/learn-by-diff)（Cursor 及其他基于 Open VSX 的 IDE）

也可以[手动安装](https://github.com/RJiazhen/learn-by-diff/releases/tag/v0.1.0)：从发布页下载 `.vsix` 文件，将其拖入拓展视图安装。

## 开始课程

点击 Explorer 的 **LEARN BY DIFF** 视图标题栏的「打开课程」按钮（或在命令面板运行 **LearnByDiff: Open Course**）。

<img src="../../images/open-course-button.png" alt="open course button" style="height: 300px; width: auto; margin: 0 auto;" />

填入以下 demo 课程配置文件地址并确认：

```text
https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.yml
```

在弹出窗口中选择一个目录存放课程仓库，课程相关文件会自动下载到该目录下。

<image src="../../images/demo-course-screenshot.png" alt="demo course screenshot" style="height: 500px; width: auto; margin: 0 auto;" />

> 下载完成后的课程仓库目录结构

对应 IDE 用户也可以点击以下链接一键开课：

- [VS Code](vscode://RuanJiazhen.learn-by-diff/open-course?url=https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.yml)
- [Cursor](cursor://RuanJiazhen.learn-by-diff/open-course?url=https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.yml)

## 按照你的风格进行学习

第一次打开课程时，会默认将第一章的初始状态代码到本地。

对于 demo 课程，你可以使用 [Live Preview](https://marketplace.cursorapi.com/items/?itemName=ms-vscode.live-server) 插件实时预览 index.html 文件。

然后点击对应章节的「已完成」按钮，就会将本地的代码替换为该章的完成状态的代码，从而预览该章的完成效果。

<video class="lbd-loop-video" src="../../video/change-chapter.mp4" autoplay muted loop playsinline></video>

当然，你也可以点击「文档」按钮查看该章的文档，了解该章的内容和学习目标。

<video class="lbd-loop-video" src="../../video/open-documents.mp4" autoplay muted loop playsinline></video>

又或者，你也可以点击章节中的文件，查看为达成目标所做的代码修改。

<video class="lbd-loop-video" src="../../video/open-file.mp4" autoplay muted loop playsinline></video>

还有诸如单独打开单一章节的代码进行对比测试、切换至未完成状态等功能，请参考 [功能](/zh/intro/features)。
