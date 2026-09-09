---
title: 開始
outline: deep
---

# 開始

## 安裝

LearnByDiff 適用於 **VS Code**、**Cursor**，以及其他以 VS Code 為基礎的 IDE。

在擴充功能檢視搜尋 **LearnByDiff**，或開啟對應商店：

- [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=RuanJiazhen.learn-by-diff)（VS Code）
- [Open VSX](https://open-vsx.org/extension/RuanJiazhen/learn-by-diff)（Cursor 及其他以 Open VSX 為基礎的 IDE）

也可以[手動安裝](https://github.com/RJiazhen/learn-by-diff/releases/tag/v0.1.0)：從發布頁下載 `.vsix` 檔案，拖入擴充功能檢視安裝。

## 開始課程

點一下 Explorer 的 **LEARN BY DIFF** 檢視標題列的「開啟課程」按鈕（或在命令選擇區執行 **LearnByDiff: 開啟課程**）。

<img src="../../images/open-course-button.png" alt="開啟課程按鈕" style="height: 300px; width: auto; margin: 0 auto;" />

貼上以下 demo 課程設定檔位址並確認：

```text
https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.yml
```

在彈出視窗中選擇一個目錄存放學習工作區，課程相關檔案會自動下載到該目錄。

<image src="../../images/demo-course-screenshot.png" alt="demo course screenshot" style="height: 500px; width: auto; margin: 0 auto;" />

> 下載完成後的學習工作區目錄結構

對應 IDE 使用者也可以點以下連結一鍵開課：

- [VS Code](vscode://RuanJiazhen.learn-by-diff/open?url=https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.yml)
- [Cursor](cursor://RuanJiazhen.learn-by-diff/open?url=https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.yml)

## 用你習慣的方式學習

第一次開啟課程時，會預設把第一章的初始狀態程式碼匯出到本機。

對於 demo 課程，可以使用 [Live Preview](https://marketplace.visualstudio.com/items?itemName=ms-vscode.live-server) 擴充功能即時預覽 `index.html`。

然後點對應章節的「已完成」按鈕，就會把本機程式碼換成該章的完成狀態，以便預覽完成效果。

<video class="lbd-loop-video" src="../../video/change-chapter.mp4" autoplay muted loop playsinline></video>

也可以點「文件」按鈕查看該章的文件，了解內容與學習目標。

<video class="lbd-loop-video" src="../../video/open-documents.mp4" autoplay muted loop playsinline></video>

或點章節中的檔案，查看為達成目標所做的程式碼修改。

<video class="lbd-loop-video" src="../../video/open-file.mp4" autoplay muted loop playsinline></video>

單獨開啟單一章節資料夾做對比、切換回未開始等功能，請參考 [功能](/zh-tw/intro/features)。
