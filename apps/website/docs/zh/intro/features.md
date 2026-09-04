---
title: 功能
outline: deep
---

# 功能

开课后，在 Explorer 的 **Learn By Diff** 视图里完成学习。

## 章节与 Diff

| 操作                | 作用                                   |
| ------------------- | -------------------------------------- |
| **未开始**          | 用该章起始快照覆盖学生树，并标为当前章 |
| **已完成**          | 用该章完成快照覆盖学生树，并标为当前章 |
| **上一章 / 下一章** | 应用相邻章的起始快照                   |
| 文件行              | 打开官方起始 ↔ 完成 Diff               |
| 文档按钮            | 打开章节文档：网页、Markdown 或 PDF    |

相对上次应用到学生树的快照，若工作区**没有改动**，覆盖会直接进行；**有改动**时会出现确认，避免丢掉你的编辑。

第一次开课会导出第 1 章的起始快照。标题栏上一章 / 下一章同样应用相邻章的**起始**状态。

## 参考运行区

除了看 Diff，有时需要把参考实现真正跑起来。

章节上的「打开未开始文件夹 / 打开已完成文件夹」会把该章快照**复制**到学习仓内，并作为额外工作区根目录加入窗口。主工作区里的你的代码不会被覆盖。

每个参考文件夹可单独开终端、起开发服务器，方便和自己的实现并排对比。

## 从链接打开课程

安装扩展后，链接可拉起 VS Code 或 Cursor 并执行 Open Course：

```text
vscode://rjiazhen.learn-by-diff/open?url=<urlencoded-course.yml-或-仓库>
cursor://rjiazhen.learn-by-diff/open?url=<urlencoded-course.yml-或-仓库>
```

`url` 可以是本地 `course.yml` 路径、`file:` URL，或课程 git 仓库地址。可选 `parent=`（同样需编码）指定学习仓父目录，跳过文件夹选择。

```html
<a href="vscode://rjiazhen.learn-by-diff/open?url=https%3A%2F%2Fgithub.com%2Forg%2Fcourse.git">
  在 VS Code 中打开
</a>
```

系统可能首次询问是否允许该协议。IDE 里必须已经装好 LearnByDiff。

## 常见问题

**课程打不开。** 确认选的是 `course.yml`，远程仓库根目录或 `.course-config/` 下有合法配置，且 Git 在 PATH 上。

**源码拉取失败。** 课程声明的源码仓库若是 git URL，本机需能访问；若是相对路径，则只在本地课程布局下有效。

**Diff 是空的。** 起始与完成目录相同则没有增量。空目录表示「从零开始」。确认章节指向的快照目录真实存在。

**文档按钮没反应。** 该章需声明文档：快照内文件路径，或 `http(s)` URL。
