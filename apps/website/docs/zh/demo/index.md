---
title: Demo 教程：光标粒子
outline: deep
---

# Demo 教程：光标粒子

你将做出一个**暗色全屏 Canvas**：粒子在屏幕上漂移，被光标吸成圆环，并带上光晕与短拖尾。

这是仓库里的本地示例课，第一章文档链到本站教程页。

| 项       | 值                                                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 课程名   | Cursor particles                                                                                                                                       |
| 配置     | [`examples/demo-course/.course-config/course.yml`](https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.yml) |
| 源码快照 | [`examples/demo-source`](https://github.com/RJiazhen/learn-by-diff/tree/main/examples/demo-source)                                                     |
| 章节     | 4 章：骨架 → 粒子 → 跟随 → 光晕                                                                                                                        |

<p class="lbd-quiet-link">
  <a href="/zh/intro/quick-start">还不会用？先看快速开始</a>
</p>

克隆 [learn-by-diff](https://github.com/RJiazhen/learn-by-diff) 之后，在 Open Course 中选择：

```text
examples/demo-course/.course-config/course.yml
```

不要把整个产品仓库的 git URL 当作课程 `url`（根目录不是课程根）。

## 章节

| 章                                | 你将得到什么                   | 大约时长   |
| --------------------------------- | ------------------------------ | ---------- |
| [01 画布骨架](/zh/demo/skeleton)  | 全窗口深色 Canvas，每帧清屏    | 15–25 分钟 |
| [02 粒子漂移](/zh/demo/particles) | 边缘环绕的漂移圆点             | 15–25 分钟 |
| [03 跟随光标](/zh/demo/follow)    | 空心圆环绕指针，离开页面后散开 | 25–40 分钟 |
| [04 光晕与拖尾](/zh/demo/glow)    | 稳定光晕 + 短拖尾              | 10–20 分钟 |

扩展里第四章的文档按钮仍指向快照里的 **PDF 样例**（`glow/docs.pdf`）。本站这一章是同一内容的网页版。

## 学习建议

- **先看 Diff，再对照本页步骤。**
- 用任意静态服务器打开 `index.html`（ES module 需要 `http://`）。
- 需要跑参考时，用章节上的参考文件夹；不要点「未开始 / 已完成」，除非你确实要覆盖主工作区。
