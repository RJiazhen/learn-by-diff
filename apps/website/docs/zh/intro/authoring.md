---
title: 制作课程
outline: deep
---

# 制作课程

一门课由配置文件 + 源码快照组成，学生输入课程配置文件的 URL 后，即可打开课程。

## 快速创建课程

哪怕不熟悉课程配置文件需要填写什么信息，你也可以通过使用本工具配套的 Skill 来快速生成课程配置文件。

使用以下命令安装本项目配套的 [课程生成 Skill](https://github.com/RuanJiazhen/learn-by-diff/tree/main/skills/generate-course-config.md)：

```bash
npx skills add RJiazhen/learn-by-diff@generate-course-config -y
```

然后在源代码所处目录下运行 `/generate-course-config` 命令，即可生成课程配置文件。

或者在运行时提供源代码的 github 仓库地址，Agent 也会自动去读取源代码并生成课程配置文件。

## 课程配置文件

每个课程都需要一个课程配置文件 `course.yml`，以及对应的章节配置文件 `chapters/*.yml`。

### course.yml

首先在你的课程仓库中新建一个 `course.yml` 文件，并粘贴以下内容：

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/RJiazhen/learn-by-diff/refs/heads/main/packages/protocol/schema.json#/$defs/course
id: demo-course
title: 测试课程
source:
  repository: https://github.com/RJiazhen/learn-by-diff.git
  root: examples/demo-source
chaptersDir: chapters
```

一个 `course.yml` 文件中可以包含以下字段：

- `id`(可选)：课程的稳定标识，也会用作学生本地学习目录的文件夹名。改成适合当路径的 slug（建议只用字母、数字、连字符）。不写则用课程所在文件夹名；若该目录是 git 仓库根，则为 `{仓库名}-learn`。
- `title`(可选)：课程显示名，出现在状态栏等界面上。改成给人看的名称即可。默认值为 `id`。
- `source.repository`(可选)：源码所在位置，允许以下三种写法：
  - git 仓库地址：例如 `https://github.com/org/repo.git`，代表源码所属的 git 仓库；
  - 本地路径：本机上的源码目录，可以是绝对路径，也可以是相对于 `course.yml` 文件的相对路径；
  - 默认值：空，表示源码就在 `course.yml` 所在仓库或同一目录。
- `source.root`(可选)：源码在 `source.repository` 中的相对路径，默认值为空，表示源码就在 `source.repository` 的根目录。
- `chaptersDir`(可选)：章节 YAML 所在目录，相对 `course.yml` 文件的地址。默认值为 `chapters`，即章节配置文件就在 `course.yml` 所在目录的 `chapters` 目录下。

### chapters/*.yml

在 `course.yml` 所在目录下新建一个 `chapters` 目录，并在该目录下新建一个 `00-start.yml` 文件，并粘贴以下内容：

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/RJiazhen/learn-by-diff/refs/heads/main/packages/protocol/schema.json#/$defs/chapter
id: start
title: 开始
fromDir: start
toDir: skeleton
entryFiles:
  - src/main.js
docs: README.md
```

首先，章节配置文件需要放在 `chaptersDir` 目录下（默认是 `course.yml` 旁边的 `chapters/`）。

每一个 `.yml` 文件对应一章，**课程顺序和文件名顺序一致**，所以建议用数字前缀排课，例如 `00-start.yml`、`01-skeleton.yml`。

同时，当章节配置文件中的 `id` 为空时，会去掉扩展名和开头的数字前缀作为 `id`，例如 `00-start.yml` → `start`。前缀可以是 `00-`、`01_`、`1.` 这种形式。一门课至少要有一个章节文件，各章 `id` 不能重复。

每个章节配置文件中，包含以下字段：

- `id`(可选)：章节的稳定标识，进度记录用它，不用于显示。默认为空，此时会从文件名推导（如上，`00-start.yml` → `start`）。
- `title`(可选)：章节显示名。默认为空，此时会用 `id`。
- `fromDir`(可选)：本章开始时的源码快照目录，相对 `source.repository`（若写了 `source.root`，则相对那一层）。默认值为空，表示空目录。不允许 `..` 或绝对路径。
- `toDir`(可选)：本章目标快照目录，相对规则同 `fromDir`。默认值为空，表示空目录。
- `entryFiles`(可选)：本章要关注的文件列表，路径相对章节快照树根（`toDir`）。默认值为所有 `toDir` 下的文件。
- `docs`(可选)：本章文档。可以是 `http(s)` URL，也可以是快照树里的文件路径（先找 `toDir`，再找 `fromDir`），例如 `README.md`。默认值为空，表示没有文档按钮。

## 分享制作好的课程

按照以下步骤将制作好的课程分享给他人：

### 上传课程仓库到 Git

首先保证课程仓库（包括源代码）已经发布到 Git。

### 分享课程配置文件地址

将课程配置文件的地址分享给他人，他人即可通过 Open Course 粘贴仓库 URL 打开课程。

### 生成一键分享链接

或者可以按照以下规则，将课程配置文件的地址转换为一键分享链接，他人点击链接即可打开课程（会唤醒 IDE 并自动打开课程）。

```text
vscode://RuanJiazhen.learn-by-diff/open?url=<course.yml地址或git仓库URL>
cursor://RuanJiazhen.learn-by-diff/open?url=<course.yml地址或git仓库URL>
```

VS Code 用 `vscode://`，Cursor 用 `cursor://`。对方需要已安装 LearnByDiff；首次点击时系统可能会询问是否允许打开该协议。

例如仓库 `https://github.com/RJiazhen/learn-by-diff.git`：

```text
vscode://RuanJiazhen.learn-by-diff/open?url=https://github.com/RJiazhen/learn-by-diff.git
cursor://RuanJiazhen.learn-by-diff/open?url=https://github.com/RJiazhen/learn-by-diff.git
```
