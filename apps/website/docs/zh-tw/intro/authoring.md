---
title: 製作課程
outline: deep
---

# 製作課程

一門課由設定檔 + 原始碼快照組成，學生輸入課程設定檔的 URL 後即可開啟課程。

## 快速建立課程

就算不熟悉課程設定檔要填什麼，也可以用本工具附帶的 Skill 快速產生。

使用以下命令安裝 [課程產生 Skill](https://github.com/RJiazhen/learn-by-diff/tree/main/skills/generate-course-config.md)：

```bash
npx skills add RJiazhen/learn-by-diff@generate-course-config -y
```

然後在原始碼所在目錄執行 `/generate-course-config`，即可產生課程設定檔。

或在執行時提供原始碼的 GitHub 倉庫位址，Agent 也會讀取原始碼並產生設定檔。

## 課程設定檔

每個課程都需要 `course.yml`，以及對應的章節設定檔 `chapters/*.yml`。

### course.yml

先在課程倉庫中新增 `course.yml`，並貼上：

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/RJiazhen/learn-by-diff/refs/heads/main/packages/protocol/schema.json#/$defs/course
id: demo-course
title: 測試課程
source:
  repository: https://github.com/RJiazhen/learn-by-diff.git
  root: examples/demo-source
chaptersDir: chapters
```

`course.yml` 可以包含以下欄位：

- `id`（可選）：課程的穩定識別碼，也會用作學生本機學習目錄的資料夾名。請改成適合作路徑的 slug（建議只用字母、數字、連字號）。不寫則用課程所在資料夾名；若該目錄是 git 倉庫根，則為 `{倉庫名}-learn`。
- `title`（可選）：課程顯示名，出現在狀態列等介面上。預設為 `id`。
- `source.repository`（可選）：原始碼所在位置，允許以下三種寫法：
  - git 倉庫位址：例如 `https://github.com/org/repo.git`，代表原始碼所屬的 git 倉庫；
  - 本機路徑：本機上的原始碼目錄，可以是絕對路徑，也可以是相對於 `course.yml` 的相對路徑；
  - 預設值：空，表示原始碼就在 `course.yml` 所在倉庫或同一目錄。
- `source.root`（可選）：原始碼在 `source.repository` 中的相對路徑，預設為空，表示原始碼就在 `source.repository` 的根目錄。
- `chaptersDir`（可選）：章節 YAML 所在目錄，相對 `course.yml` 檔案的位址。預設為 `chapters`，即章節設定檔在 `course.yml` 所在目錄的 `chapters` 目錄下。

### chapters/*.yml

在 `course.yml` 所在目錄下新增 `chapters` 目錄，並在該目錄下新增 `00-start.yml`，貼上：

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/RJiazhen/learn-by-diff/refs/heads/main/packages/protocol/schema.json#/$defs/chapter
id: start
title: 開始
fromDir: start
toDir: skeleton
entryFiles:
  - src/main.js
docs: README.md
```

章節設定檔需放在 `chaptersDir` 目錄下（預設是 `course.yml` 旁邊的 `chapters/`）。

每一個 `.yml` 檔對應一章，**課程順序和檔名順序一致**，所以建議用數字前綴排課，例如 `00-start.yml`、`01-skeleton.yml`。

當章節設定檔中的 `id` 為空時，會去掉副檔名和開頭的數字前綴作為 `id`，例如 `00-start.yml` → `start`。前綴可以是 `00-`、`01_`、`1.` 這種形式。一門課至少要有一個章節檔，各章 `id` 不能重複。

每個章節設定檔包含以下欄位：

- `id`（可選）：章節的穩定識別碼，進度紀錄用它，不用於顯示。預設為空，此時會從檔名推導（如上，`00-start.yml` → `start`）。
- `title`（可選）：章節顯示名。預設為空，此時會用 `id`。
- `fromDir`（可選）：本章開始時的原始碼快照目錄，相對 `source.repository`（若寫了 `source.root`，則相對那一層）。預設為空，表示空目錄。不允許 `..` 或絕對路徑。
- `toDir`（可選）：本章目標快照目錄，相對規則同 `fromDir`。預設為空，表示空目錄。
- `entryFiles`（可選）：本章要關注的檔案清單，路徑相對章節快照樹根（`toDir`）。預設為所有 `toDir` 下的檔案。
- `docs`（可選）：本章文件。可以是 `http(s)` URL，也可以是快照樹裡的檔案路徑（先找 `toDir`，再找 `fromDir`），例如 `README.md`。預設為空，表示沒有文件按鈕。

## 分享製作好的課程

依下列步驟將課程分享給他人：

### 上傳課程倉庫到 Git

先確保課程倉庫（包含原始碼）已發布到 Git。

### 分享課程設定檔位址

將課程設定檔的位址分享給他人，他人即可透過 Open Course 貼上倉庫 URL 開啟課程。

### 產生一鍵分享連結

或依下列規則，將課程設定檔位址轉成一鍵分享連結，他人點連結即可開啟課程（會喚醒 IDE 並自動開啟課程）。

```text
vscode://RuanJiazhen.learn-by-diff/open?url=<course.yml位址或git倉庫URL>
cursor://RuanJiazhen.learn-by-diff/open?url=<course.yml位址或git倉庫URL>
```

VS Code 用 `vscode://`，Cursor 用 `cursor://`。對方需要已安裝 LearnByDiff；首次點擊時系統可能會詢問是否允許開啟該協定。

例如倉庫 `https://github.com/RJiazhen/learn-by-diff.git`：

```text
vscode://RuanJiazhen.learn-by-diff/open?url=https://github.com/RJiazhen/learn-by-diff.git
cursor://RuanJiazhen.learn-by-diff/open?url=https://github.com/RJiazhen/learn-by-diff.git
```
