# Product design notes (WIP)

临时产品思路记录，非正式规格；实现前仍需验证 VS Code / Cursor API 可行性。

## 核心定位：参考，而不是覆盖

插件的核心价值是**参考代码**（diff / 对照实现），而不是替用户改本地树。

- 默认应以用户**本地代码**为基础；插件提供章节 start ↔ goal 的 diff，供用户对照后自己改。
- **除非用户明确选择**「用某章节 start / finish 快照覆盖本地」，否则不应静默替换工作区文件。
- 章节行只有两个覆盖按钮：**Not Started**（`fromDir`）和 **Completed**（`toDir`）。点任一按钮都会把该章标为激活，并显示 `Not Started` 或 `Completed`。相对上次应用到学生树的快照无改动则直接覆盖；有改动才 QuickPick。

标题栏 prev / next 会应用相邻章的 **start**。首次开课仍 export 第 1 章 `fromDir`。

## 参考代码可运行副本（多根工作区设想）

除了看 diff，用户有时需要**真正跑起来**对比效果（开发服务器、页面交互等）。

设想流程：

1. 用户点击章节标题上的按钮（例如「打开参考运行区」）。
2. 将该章节的参考快照（`toDir` 或可选 start/goal）**复制**到 `.learn/` 下的子目录（例如 `.learn/refs/<chapterId>/`），不碰主工作区用户代码。
3. 在 Explorer 中把该子目录加为**额外工作区文件夹**（multi-root workspace），方便单独浏览、终端 cwd、启动 dev server。
4. **待验证**

- VS Code / Cursor 是否方便地把学习仓内的子目录动态加成独立 workspace folder。
- 终端是否能可靠地默认打开到该新增 folder 的根目录。

5. **默认一章一工作区文件夹**（或一章一个 ref 副本），以便：

- 各章参考代码可分别起一个开发服务器，并排对比效果；
- 用户仍可在主工作区用自己的实现测效果，与参考互不覆盖。

## 主工作区 vs 参考子工作区的状态切换

现在还缺：**参考子工作区**里在 start ↔ finish 之间切换可运行副本。

主工作区已用 **Not Started** / **Completed** 覆盖学生树，并显示对应状态。文件行仍打开官方 from ↔ to diff。

| 区域                            | 需求                                           |
| ------------------------------- | ---------------------------------------------- |
| 主工作区                        | 已落地：Start / Finish 覆盖并激活该章          |
| 参考子工作区（`.learn/refs/…`） | 在该副本内切换 start ↔ goal 快照，便于运行对比 |

## 示例课程方向

现有 demo（greeting / hello / world / bang）偏示意。后续可换成更有**实际意义与视觉冲击**的例子，例如：

- 用 CSS + JS 做**粒子跟随光标**的页面效果；
- 拆成多步，每步一个章节（骨架 → 粒子 → 跟随 → 样式强化 …）；
- 方便展示「看参考 diff → 自己改主工作区 → 需要时开 ref 工作区跑效果」的完整学习路径。

## `.course-config` 支持多份课程配置（多语言）

同一仓库可以提供**多份不同语言的教程**（例如中文 / 英文），而不是只放一份 `course.yml`。

方向：

- `.course-config` 下可存在**多份独立课程配置**（各有自己的 `course.yml` + `chapters/`），而不仅是今天的单根布局。
- 典型场景：同一套 source 快照、同一套章节节奏，文案 / 文档语言不同；`source.repository` 可共用。
- 开课时若发现多份配置，让用户选择（QuickPick）；只有一份时行为与现在一致。
- 向后兼容：现有 `.course-config/course.yml` + `chapters/` 仍是合法的单课程仓库。

**待定（实现前核对）**

- 磁盘布局：子目录（`.course-config/zh/`、`.course-config/en/`）还是并列 YAML。
- 默认选哪一份（仓库约定、系统 locale、上次选择）。
- Deep link 是否带课程 / 语言选择（避免打开仓库后还要再选一次）。
- 章节 YAML 是否必须按语言各写一份，还是可共享章节结构、只覆盖 `title` / `docs`。

## 项目官网与 demo 教程地址

需要一份**项目官网**，并在其上提供 demo 教程的地址（https）。

由此可以收掉现在仅为演示 https `docs` 而存在的空白章：

- 已删除 demo 的空白章节（`005-blank`）。
- 第一章（skeleton）的 `docs` 改为官网上的 demo 教程 URL，同时覆盖「章节文档可以是 http(s)」这条路径。

Markdown / PDF 等本地文档样例仍可由后续章节保留（如 particles 的 `README.md`、glow 的 `docs.pdf`）。

## Skill：生成后便于本地试课

已落地：`generate-course-config` 收尾应打印课程根绝对路径，以及 `vscode://` / `cursor://rjiazhen.learn-by-diff/open?url=`（`file:` 或绝对路径，URI handler 已支持）。

## 非空目录与课程菜单

后续需要专门测试并补齐：

1. **在非空目录下打开课程**的效果（已有文件的文件夹作为学习仓 / 父目录时的交互、冲突、gitignore 合并等）。

已落地：非学习仓工作区仍显示 **Learn By Diff** 视图（欢迎页 + 标题栏 **Open Course**）；视图名带空格。

## 开放问题（实现前核对）

- [x] multi-root：运行时 `vscode.workspace.updateWorkspaceFolders` 加 `.learn/refs/<id>` 是否稳定、是否与单文件夹学习仓打开方式兼容
- [x] 终端 / Task：新建 folder 后如何把 cwd 指到该 folder
- [x] 章节切换 UI：Not Started / Completed 覆盖并显示对应状态；prev/next 应用相邻章 start
- [x] ref 副本与 source mirror / snapshots 的关系（直接从 mirror export，还是复用已有 snapshot 目录）
- [x] 一章多 ref（start 一份、goal 一份）还是一章一份可切换内容
- [x] skill 收尾：本地 `open?url=` 对 `file:` / 绝对路径课程根已与 URI handler 对齐；skill 文案要求打印 deep link
- [ ] 非空目录开课：覆盖策略、已有 `.learn`、已有 git 历史时的行为
- [x] 非学习仓工作区：视图始终显示，欢迎页与标题栏提供 Open Course
- [x] 视图显示名：`package.json` `views.explorer.name` 改为 `Learn By Diff`
- [ ] `.course-config` 多课程：磁盘布局、开课选择、deep link、与单 `course.yml` 的兼容
- [x] 项目官网：GitHub Pages `https://rjiazhen.github.io/learn-by-diff/`；第一章 `docs` 指向该站教程 URL；已删除空白章
