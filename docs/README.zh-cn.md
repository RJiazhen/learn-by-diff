[简体中文](README.zh-cn.md) | [English](../README.md) | [繁體中文](README.zh-tw.md) | [日本語](README.ja.md)

# LearnByDiff

以 diff 的形式直观地学习各类课程源码，无须担心跟着课程学习时跟丢遗漏代码。

完整说明与演示视频见项目网站：[rjiazhen.github.io/learn-by-diff](https://rjiazhen.github.io/learn-by-diff/)。

## 安装

在扩展视图搜索 **LearnByDiff**，或打开对应商店：

- [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=RuanJiazhen.learn-by-diff)（VS Code）
- [Open VSX](https://open-vsx.org/extension/RuanJiazhen/learn-by-diff)（Cursor 及其他基于 Open VSX 的 IDE）

也可以[手动安装](https://github.com/RJiazhen/learn-by-diff/releases/latest)：从发布页下载 `.vsix`，拖入扩展视图。

## 打开课程

点击 Explorer 中 **LEARN BY DIFF** 视图标题栏的「打开课程」按钮（或在命令面板运行 **LearnByDiff: 打开课程**）。

<img src="https://raw.githubusercontent.com/RJiazhen/learn-by-diff/main/apps/website/docs/images/open-course-button.png" alt="打开课程按钮" style="max-width: 300px; display: block; margin: 0 auto;">

填入以下 demo 课程配置地址并确认：

```text
https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.yml
```

在弹出窗口中选择一个目录存放学习工作区，课程相关文件会下载到该目录。

下载完成后的学习工作区：

<img src="https://raw.githubusercontent.com/RJiazhen/learn-by-diff/main/apps/website/docs/images/demo-course-screenshot.png" alt="下载完成后的学习工作区" style="max-width: 300px; display: block; margin: 0 auto;">

已安装扩展时，也可以点击以下链接一键开课：

- [VS Code](vscode://RuanJiazhen.learn-by-diff/open?url=https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.yml)
- [Cursor](cursor://RuanJiazhen.learn-by-diff/open?url=https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.yml)

## 按你的方式学习

第一次打开课程时，会把第一章的**未开始**快照导出到本地。对于 demo 课程，可用 [Live Preview](https://marketplace.visualstudio.com/items?itemName=ms-vscode.live-server) 预览 `index.html`。

Learn By Diff 视图会列出章节，并提供以下功能：

| 操作                 | 作用                                       |
| -------------------- | ------------------------------------------ |
| **上一章 / 下一章**  | 切换到相邻章节的未开始状态                 |
| **打开章节文档**     | 打开该章的课程文档                         |
| **未开始**           | 用该章的初始快照覆盖本地代码               |
| **已完成**           | 用该章的完成快照覆盖本地代码               |
| **打开未开始文件夹** | 把该章的未开始快照作为独立文件夹加入工作区 |
| **打开已完成文件夹** | 把该章的已完成快照作为独立文件夹加入工作区 |

你可以随时改代码，以观察代码变化对功能的影响。

也可以直接展开查看每一章节为了实现功能所做的修改。

更多功能见网站：[功能](https://rjiazhen.github.io/learn-by-diff/zh/intro/features.html)。

## 贡献

请参考 [贡献指南](../CONTRIBUTING.md)。
