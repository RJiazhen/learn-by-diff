---
title: 制作课程
outline: deep
---

# 制作课程

一门课由配置文件 + 源码快照组成。学生用 Open Course 打开配置后，按章节对照 Diff 学习。

## 仓库怎么摆

任选一种布局：

```text
course.yml                 # Open Course 选这个文件
chapters/*.yml

# 或者

.course-config/course.yml
.course-config/chapters/*.yml
```

另准备**源码仓库**（可与课程同仓，也可单独仓库）：每章对应一对目录快照（起始 → 完成）。课程里用 `source.repository` 指向它，可选 `source.root` 作为章节目录前缀。一份课程只有一个源码仓库，不能按章挂不同远程。

## 写配置

`course.yml` 与章节 YAML 的字段都是可选的，缺省用路径 / 文件名推断。常用字段：

| 位置 | 字段                | 含义                                                     |
| ---- | ------------------- | -------------------------------------------------------- |
| 课程 | `title`             | 显示名                                                   |
| 课程 | `source.repository` | 源码仓库（默认 `.`，即课程主目录）                       |
| 课程 | `chaptersDir`       | 章节 YAML 目录（默认 `chapters`）                        |
| 章节 | `fromDir` / `toDir` | 该章起始 / 完成快照目录                                  |
| 章节 | `docs`              | 文档：快照内文件，或 `http(s)` URL                       |
| 章节 | `entryFiles`        | 要出现在 Diff 列表里的文件（默认枚举完成快照下全部文件） |

编辑器可在文件头加 schema 注释（把相对路径改成你仓库里的实际位置）：

```yaml
# yaml-language-server: $schema=../../../packages/protocol/schema.json#/$defs/course
```

章节文件把末尾改成 `#/$defs/chapter`。

## 用 Skill 生成配置

若已有按步骤分好的快照目录，可用 Agent Skill 脚手架配置：

```bash
npx skills add RJiazhen/learn-by-diff@generate-course-config -y
```

在 Agent 对话里运行 `/generate-course-config`。生成后会打印课程路径和可试开的 deep link。

## 给学生怎么开

- 把课程仓库发布到 Git，让学生用 Open Course 贴仓库 URL，或选本地 `course.yml`。
- 在文档里放 [deep link](/zh/intro/features#从链接打开课程)，学生点一下即可开课。
- 章节 `docs` 可指向本站或其它 https 教程页，也可放快照内的 Markdown / PDF。
