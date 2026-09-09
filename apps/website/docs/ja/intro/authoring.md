---
title: コースを作る
outline: deep
---

# コースを作る

コースは設定ファイルとソースのスナップショットで構成されます。学習者はコース設定の URL を貼り付けて開きます。

## すばやく作る

設定ファイルに何を書けばよいか分からなくても、付属の Skill で生成できます。

[コース生成 Skill](https://github.com/RJiazhen/learn-by-diff/tree/main/skills/generate-course-config.md) をインストールします。

```bash
npx skills add RJiazhen/learn-by-diff@generate-course-config -y
```

ソーススナップショットがあるディレクトリで `/generate-course-config` を実行します。

GitHub リポジトリ URL を渡せば、エージェントがソースを読んで設定を生成します。

## コース設定ファイル

各コースには `course.yml` と章ファイル `chapters/*.yml` が必要です。

### course.yml

コースリポジトリに `course.yml` を作り、次を貼り付けます。

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/RJiazhen/learn-by-diff/refs/heads/main/packages/protocol/schema.json#/$defs/course
id: demo-course
title: デモコース
source:
  repository: https://github.com/RJiazhen/learn-by-diff.git
  root: examples/demo-source
chaptersDir: chapters
```

`course.yml` のフィールド:

- `id`（任意）: 安定したコース ID。学習ワークスペースのフォルダー名にも使います。パスに使える slug（英数字とハイフン）を推奨。省略時はコースフォルダー名。そのフォルダーが git リポジトリルートなら `{リポジトリ名}-learn`。
- `title`（任意）: ステータスバーなどに出す表示名。省略時は `id`。
- `source.repository`（任意）: ソースの場所。次の 3 通りです。
  - git リポジトリ URL。例: `https://github.com/org/repo.git`
  - ローカルパス。絶対パス、または `course.yml` からの相対パス。
  - 省略: ソースは `course.yml` と同じリポジトリまたは同じディレクトリ。
- `source.root`（任意）: `source.repository` 内のソースディレクトリ。省略時はリポジトリルート。
- `chaptersDir`（任意）: 章 YAML のディレクトリ。`course.yml` からの相対パス。省略時は `course.yml` の隣の `chapters`。

### chapters/*.yml

`course.yml` の隣に `chapters` ディレクトリを作り、`00-start.yml` を作って次を貼り付けます。

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

章ファイルは `chaptersDir` に置きます（省略時は `course.yml` の隣の `chapters/`）。

各 `.yml` が 1 章です。**コース順はファイル名順**なので、`00-start.yml`、`01-skeleton.yml` のように数字プレフィックスを付けます。

`id` が空のときは、拡張子と先頭の数字プレフィックスを除いて ID になります。`00-start.yml` → `start`。プレフィックスは `00-`、`01_`、`1.` などが使えます。コースには少なくとも 1 つの章ファイルが必要で、章 `id` は重複できません。

各章ファイルのフィールド:

- `id`（任意）: 進捗用の安定した章 ID。表示には使いません。省略または空ならファイル名から導出（上記のとおり）。
- `title`（任意）: 表示名。省略または空なら `id`。
- `fromDir`（任意）: 章の開始スナップショット。`source.repository` からの相対（`source.root` があればその下）。空なら空のツリー。`..` と絶対パスは不可。
- `toDir`（任意）: 章の目標スナップショット。パス規則は `fromDir` と同じ。空なら空のツリー。
- `entryFiles`（任意）: 注目するファイル。章スナップショットのルート（`toDir`）からの相対。省略時は `toDir` 以下の全ファイル。
- `docs`（任意）: 章のドキュメント。`http(s)` URL、またはスナップショット内のファイル（先に `toDir`、次に `fromDir`）。例: `README.md`。省略時はドキュメントボタンなし。

## コースを共有する

次の手順で完成したコースを共有します。

### コースリポジトリを Git に載せる

ソースを含むコースリポジトリを Git に公開します。

### 設定ファイルの場所を共有する

GitHub 上にある場合は、`course.yml` のアドレスを共有できます。相手は Open Course に貼り付けます。

例:

```text
https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.yml
```

`course.yml` がリポジトリルート、またはルート直下の `.course-config/course.yml` にあるときは、git リポジトリ URL だけでも共有できます。

```text
https://github.com/RJiazhen/learn-by-diff.git
```

`course.yml` がサブディレクトリにあるときは、git URL に `#` と、リポジトリルートからの相対パス（`course.yml` を指す）を付けます。

```text
https://github.com/RJiazhen/learn-by-diff.git#examples/demo-course/.course-config/course.yml
```

### ワンクリック共有リンク

そのアドレスをワンクリックリンクに変換することもできます。クリックすると IDE が起き、コースが開きます。

```text
vscode://RuanJiazhen.learn-by-diff/open?url=<course.ymlのアドレスまたはgitリポジトリURL>
cursor://RuanJiazhen.learn-by-diff/open?url=<course.ymlのアドレスまたはgitリポジトリURL>
```

VS Code は `vscode://`、Cursor は `cursor://`。相手は LearnByDiff をインストール済みである必要があります。初回はプロトコルを開く許可を求められることがあります。

リポジトリ `https://github.com/RJiazhen/learn-by-diff.git` の例:

```text
vscode://RuanJiazhen.learn-by-diff/open?url=https://github.com/RJiazhen/learn-by-diff.git
cursor://RuanJiazhen.learn-by-diff/open?url=https://github.com/RJiazhen/learn-by-diff.git
```
