---
title: 残すファイル
outline: deep
---

# 残すファイル

章を切り替えると、学習フォルダー内のソースは、その章のスナップショットで**置き換え**られます。2 章のファイルが混ざることはありません。スナップショットはまずその場にコピーされ、スナップショットに無いパスが削除されます。

`course.jsonc` の `retain` は **`.gitignore` と同じマッチ規則**です（学習フォルダーのルートから評価）:

- `node_modules` はツリー内のどの `node_modules` も残す
- `/node_modules` はルートの `node_modules` だけ残す
- `node_modules/` はディレクトリのみ
- `*.log` はその接尾辞をどのディレクトリでもマッチ
- `!important.txt` は gitignore の否定

`retain` を省略すると `node_modules` が残ります。明示的な `[]` は、追加のプロジェクトパスを残しません。

学習フォルダーのコピー `.learn/course/course.jsonc` は、さらに `.git`、`.learn`、`.gitignore`、`*.code-workspace` を足します。これらは自分で書かなくて構いません。

ワークスペースの `.gitignore` は、git にコミットしないファイルを示すだけです。章の切り替えで何を残すかは `retain` だけが決めます。

## 注意

- スナップショットにあるファイルは、`retain` にマッチしても上書きされます。
- `dist/` のように git が無視するフォルダーも、`retain` にマッチしなければ削除されます。
