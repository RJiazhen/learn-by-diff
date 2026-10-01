---
title: 保留檔案
outline: deep
---

# 保留檔案

切換章節時，學習目錄裡的原始碼會被對應的章節快照**取代**，而不是把兩章的檔案混在一起。快照會先原位複製，再刪除不在快照裡的路徑。

在 `course.jsonc` 裡，`retain` 使用與 **`.gitignore` 相同的匹配規則**（從學習目錄根算起）：

- `node_modules` 會保留樹中任意位置的 `node_modules`
- `/node_modules` 只保留根目錄的 `node_modules`
- `node_modules/` 只匹配目錄
- `*.log` 匹配任意目錄下的該後綴
- `!important.txt` 為 gitignore 式否定

省略 `retain` 時會保留 `node_modules`。明確寫成 `[]` 則不額外保留專案路徑。

學習目錄裡的副本 `.learn/course/course.jsonc` 還會加上 `.git`、`.learn`、`.gitignore` 和 `*.code-workspace`。這些不用自己寫。

工作區 `.gitignore` 仍然只告訴 git 哪些檔案不要提交。切換章節時留下什麼，只看 `retain`。

## 注意

- 快照裡已有的檔案仍會被快照覆蓋，即使 `retain` 也匹配到了它。
- 被 git 忽略的目錄（例如 `dist/`）如果沒有被 `retain` 匹配到，切章時會被刪除。
