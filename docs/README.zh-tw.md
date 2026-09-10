[简体中文](README.zh-cn.md) | [English](../README.md) | [繁體中文](README.zh-tw.md) | [日本語](README.ja.md)

# LearnByDiff

以 diff 的形式直觀地學習各類課程原始碼，無須擔心跟著課程學習時跟丟遺漏程式碼。

完整說明與示範影片見專案網站：[rjiazhen.github.io/learn-by-diff](https://rjiazhen.github.io/learn-by-diff/)。

## 安裝

在擴充功能檢視搜尋 **LearnByDiff**，或開啟對應商店：

- [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=RuanJiazhen.learn-by-diff)（VS Code）
- [Open VSX](https://open-vsx.org/extension/RuanJiazhen/learn-by-diff)（Cursor 及其他以 Open VSX 為基礎的 IDE）

也可以[手動安裝](https://github.com/RJiazhen/learn-by-diff/releases/latest)：從發布頁下載 `.vsix`，拖入擴充功能檢視。

## 開啟課程

點一下 Explorer 中 **LEARN BY DIFF** 檢視標題列的「開啟課程」按鈕（或在命令選擇區執行 **LearnByDiff: 開啟課程**）。

<img src="https://raw.githubusercontent.com/RJiazhen/learn-by-diff/main/apps/website/docs/images/open-course-button.png" alt="開啟課程按鈕" style="max-width: 300px; display: block; margin: 0 auto;">

貼上以下 demo 課程設定檔位址並確認：

```text
https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.yml
```

在彈出視窗中選擇一個目錄存放學習工作區，課程相關檔案會下載到該目錄。

下載完成後的學習工作區：

<img src="https://raw.githubusercontent.com/RJiazhen/learn-by-diff/main/apps/website/docs/images/demo-course-screenshot.png" alt="下載完成後的學習工作區" style="max-width: 300px; display: block; margin: 0 auto;">

已安裝擴充功能時，也可以點以下連結一鍵開課：

- [VS Code](vscode://RuanJiazhen.learn-by-diff/open?url=https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.yml)
- [Cursor](cursor://RuanJiazhen.learn-by-diff/open?url=https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.yml)

## 用你習慣的方式學習

第一次開啟課程時，會把第一章的**未開始**快照匯出到本機。對於 demo 課程，可用 [Live Preview](https://marketplace.visualstudio.com/items?itemName=ms-vscode.live-server) 預覽 `index.html`。

Learn By Diff 檢視會列出章節，並提供以下功能：

| 操作                 | 作用                                       |
| -------------------- | ------------------------------------------ |
| **上一章 / 下一章**  | 切換到相鄰章節的未開始狀態                 |
| **開啟章節文件**     | 開啟該章的課程文件                         |
| **未開始**           | 用該章的初始快照覆蓋本機程式碼             |
| **已完成**           | 用該章的完成快照覆蓋本機程式碼             |
| **開啟未開始資料夾** | 把該章的未開始快照作為獨立資料夾加入工作區 |
| **開啟已完成資料夾** | 把該章的已完成快照作為獨立資料夾加入工作區 |

你可以隨時改程式碼，以觀察程式碼變化對功能的影響。

也可以直接展開查看每一章節為了實現功能所做的修改。

更多功能見網站：[功能](https://rjiazhen.github.io/learn-by-diff/zh-tw/intro/features.html)。

## 貢獻

請參考 [貢獻指南](../CONTRIBUTING.md)。
