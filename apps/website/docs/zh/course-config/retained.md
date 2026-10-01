---
title: 保留文件
outline: deep
---

# 保留文件

切换章节时，学习目录里的源码会被对应的章节快照**替换**，而不是把两章的文件混在一起。快照会先原位复制，再删除不在快照里的路径。

在 `course.jsonc` 里，`retain` 使用与 **`.gitignore` 相同的匹配规则**（从学习目录根算起）：

- `node_modules` 会保留树中任意位置的 `node_modules`
- `/node_modules` 只保留根目录的 `node_modules`
- `node_modules/` 只匹配目录
- `*.log` 匹配任意目录下的该后缀
- `!important.txt` 为 gitignore 式否定

省略 `retain` 时会保留 `node_modules`。显式写成 `[]` 则不额外保留项目路径。

学习目录里的副本 `.learn/course/course.jsonc` 还会加上 `.git`、`.learn`、`.gitignore` 和 `*.code-workspace`。这些不用自己写。

工作区 `.gitignore` 仍然只告诉 git 哪些文件不要提交。切换章节时留下什么，只看 `retain`。

## 注意

- 快照里已有的文件仍会被快照覆盖，即使 `retain` 也匹配到了它。
- 被 git 忽略的目录（例如 `dist/`）如果没有被 `retain` 匹配到，切章时会被删除。
