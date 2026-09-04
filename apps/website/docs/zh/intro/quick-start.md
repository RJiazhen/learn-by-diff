---
title: 快速开始
outline: deep
---

# 快速开始

几分钟内装好扩展并打开一门课。

## 1. 安装扩展

LearnByDiff 用于 **VS Code** 与 **Cursor**（需兼容 `^1.90.0`）。

在扩展市场搜索 **LearnByDiff**（publisher `rjiazhen`）：

- [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=rjiazhen.learn-by-diff)
- [Open VSX](https://open-vsx.org/extension/rjiazhen/learn-by-diff)

若商店尚未上架，可向课程作者索取 `.vsix`，在 IDE 中「从 VSIX 安装」。

学生侧不需要 Node，需要本机已安装 **Git**。

## 2. 打开课程

1. 命令面板运行 **LearnByDiff: Open Course**（也可点 Explorer 里 **Learn By Diff** 视图标题栏的打开按钮）。
2. 选一个**父目录**。扩展会创建 `{父目录}/{courseId}/` 作为学习仓。
3. 选中课程仓库里的 `course.yml`，或 `.course-config/course.yml`。

也可以用网页 / 文档里的 [deep link](/zh/intro/features#从链接打开课程) 一键开课（需已安装扩展）。

::: tip
Open Course 要的是 **`course.yml` 文件**，或含该配置的 **git 仓库 URL**。不要传一个「可能含配置」的目录。
:::

## 3. 开始学

打开后侧栏会出现 **Learn By Diff** 视图：

1. 看当前章的文件列表，点文件打开官方 Diff。
2. 对照参考，在自己的主工作区里改代码。
3. 需要重置到章初或章末时，再点「未开始」或「已完成」。

更完整的操作说明见 [功能](/zh/intro/features)。若要自己写课，见 [制作课程](/zh/intro/authoring)。
