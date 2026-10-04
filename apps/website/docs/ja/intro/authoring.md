---
title: コースを作る
outline: deep
---

# コースを作る

コースは設定ファイルとソースのスナップショットで構成されます。学習者はコース設定の URL を貼り付けて開きます。

## すばやく作る

設定ファイルに何を書けばよいか分からなくても、この拡張機能の skill と AI エージェントでコース設定をすばやく生成できます。

1. まず IDE でソーススナップショットがあるフォルダを開きます（フォルダ未オープン時はコマンドが使えません。Learn By Diff ビュー上にもありません）。
2. コマンドパレットで **LearnByDiff: コース生成 Skill をインストール** を実行します。拡張機能がそのフォルダに [コース生成 Skill](https://github.com/RJiazhen/learn-by-diff/tree/main/skills/generate-course-config.md) をインストールし、貼り付け可能な `/generate-course-config` プロンプトをクリップボードにコピーします。
3. プロンプトをエージェントのチャットに貼り付け、必要に応じてプレースホルダのパスを直して送信すると、コース設定が生成されます。

```text
Snapshot path: ./path/to/chapter/code/root/folder
Target folder: ./course-config
```

拡張機能のコマンドを使わず、スナップショットディレクトリで手動実行することもできます。

```bash
npx skills add RJiazhen/learn-by-diff@generate-course-config -y
```

そのあと `/generate-course-config` を実行します。

GitHub リポジトリ URL を渡せば、エージェントがソースを読んで設定を生成します。

## コース設定ファイル

各コースには `course.jsonc` と章ファイル `chapters/*.jsonc` が必要です。

### course.jsonc

コースリポジトリに `course.jsonc` を作り、次を貼り付けます。

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/RJiazhen/learn-by-diff/refs/heads/main/packages/protocol/schema.json#/$defs/course",
  "id": "demo-course",
  "title": "デモコース",
  "source": {
    "repository": "https://github.com/RJiazhen/learn-by-diff.git",
    "root": "examples/demo-source",
  },
  "chaptersDir": "chapters",
}
```

`course.jsonc` のフィールド:

- `id`（任意）: 安定したコース ID。学習ワークスペースのフォルダー名にも使います。パスに使える slug（英数字とハイフン）を推奨。省略時はコースフォルダー名。そのフォルダーが git リポジトリルートなら `{リポジトリ名}-learn`。
- `title`（任意）: 人が読むための表示名。省略時は `id`。
- `source.repository`（任意）: ソースの場所。次の 3 通りです。
  - git リポジトリ URL。例: `https://github.com/org/repo.git`
  - ローカルパス。絶対パス、または `course.jsonc` があるディレクトリからの相対パス。
  - 省略: ソースは `course.jsonc` があるディレクトリ。
- `source.root`（任意）: `source.repository` 内のソースディレクトリ。省略時はリポジトリルート。
- `chaptersDir`（任意）: 章 JSONC のディレクトリ。`course.jsonc` からの相対パス。省略時は `course.jsonc` の隣の `chapters`。
- `retain`（任意）: 章スナップショット適用時に残すパス。`.gitignore` と同じ規則（学習フォルダーのルートから。`node_modules` はどの階層の同名ディレクトリも残す）。省略時は `node_modules`。`[]` は追加のプロジェクトパスを残さない。ワークスペースの `.gitignore` では制御しない。詳しくは [残すファイル](../course-config/retained)。

### chapters/*.jsonc

`course.jsonc` の隣に `chapters` ディレクトリを作り、`00-start.jsonc` を作って次を貼り付けます。

```jsonc
{
  "$schema": "https://raw.githubusercontent.com/RJiazhen/learn-by-diff/refs/heads/main/packages/protocol/schema.json#/$defs/chapter",
  "id": "start",
  "title": "開始",
  "fromDir": "start",
  "toDir": "skeleton",
  "entryFiles": ["src/main.js"],
  "docs": "README.md",
}
```

章ファイルは `chaptersDir` に置きます（省略時は `course.jsonc` の隣の `chapters/`）。

各 `.jsonc` が 1 章です。**コース順はファイル名順**なので、`00-start.jsonc`、`01-skeleton.jsonc` のように数字プレフィックスを付けます。

`id` が空のときは、拡張子と先頭の数字プレフィックスを除いて ID になります。`00-start.jsonc` → `start`。プレフィックスは `00-`、`01_`、`1.` などが使えます。コースには少なくとも 1 つの章ファイルが必要で、章 `id` は重複できません。

各章ファイルのフィールド:

- `id`（任意）: 進捗用の安定した章 ID。表示には使いません。省略または空ならファイル名から導出（上記のとおり）。
- `title`（任意）: 表示名。省略または空なら `id`。
- `fromDir`（任意）: 章の開始スナップショット。`source.repository` からの相対（`source.root` があればその下）。空なら空のツリー。`..` と絶対パスは不可。
- `toDir`（任意）: 章の目標スナップショット。パス規則は `fromDir` と同じ。空なら空のツリー。
- `entryFiles`（任意）: 注目するファイル。章スナップショットのルート（`toDir`）からの相対。省略時は `toDir` 以下の全ファイル。
- `changedFiles`（任意）: `fromDir` から `toDir` への差分（`path` と `U` 追加 / `M` 変更 / `D` 削除）。書くと Open Course はスナップショット比較を省略します。省略時は実行時に分類。空配列は章に変更なし。generate-course-config はスキャフォールド時に埋めます。
- `docs`（任意）: 章のドキュメント。`http(s)` URL、またはスナップショット内のファイル（先に `toDir`、次に `fromDir`）。例: `README.md`。省略時はドキュメントボタンなし。

### 残すファイル

章を切り替えると、`retain` は `.gitignore` と同じ規則でパスを残します。省略時はどの階層の `node_modules` も残ります。書き方は [残すファイル](../course-config/retained) を参照してください。

## コースを共有する

次の手順で完成したコースを共有します。

### コースリポジトリを Git に載せる

ソースを含むコースリポジトリを Git に公開します。

### 設定ファイルの場所を共有する

GitHub 上にある場合は、`course.jsonc` のアドレスを共有できます。相手は Open Course に貼り付けます。

例:

```text
https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.jsonc
```

`course.jsonc` がリポジトリルート、またはルート直下の `.course-config/course.jsonc` にあるときは、git リポジトリ URL だけでも共有できます。

```text
https://github.com/RJiazhen/learn-by-diff.git
```

`course.jsonc` がサブディレクトリにあるときは、git URL に `#` と、リポジトリルートからの相対パス（`course.jsonc` を指す）を付けます。

```text
https://github.com/RJiazhen/learn-by-diff.git#examples/demo-course/.course-config/course.jsonc
```

### ワンクリック共有リンク

そのアドレスをワンクリックリンクに変換することもできます。クリックすると IDE が起き、コースが開きます。

```text
vscode://RuanJiazhen.learn-by-diff/open?url=<course.jsoncのアドレスまたはgitリポジトリURL>
cursor://RuanJiazhen.learn-by-diff/open?url=<course.jsoncのアドレスまたはgitリポジトリURL>
```

VS Code は `vscode://`、Cursor は `cursor://`。相手は LearnByDiff をインストール済みである必要があります。初回はプロトコルを開く許可を求められることがあります。

リポジトリ `https://github.com/RJiazhen/learn-by-diff.git` の例:

```text
vscode://RuanJiazhen.learn-by-diff/open?url=https://github.com/RJiazhen/learn-by-diff.git
cursor://RuanJiazhen.learn-by-diff/open?url=https://github.com/RJiazhen/learn-by-diff.git
```
