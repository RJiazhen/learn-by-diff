[简体中文](README.zh-cn.md) | [English](../README.md) | [繁體中文](README.zh-tw.md) | [日本語](README.ja.md)

# LearnByDiff

diff の形でコースのソースを直感的に学べます。講座に沿って進めても、変更の見落としを心配しなくて大丈夫です。

詳細とデモ動画はプロジェクトサイト：[rjiazhen.github.io/learn-by-diff](https://rjiazhen.github.io/learn-by-diff/)。

## インストール

拡張機能ビューで **LearnByDiff** を検索するか、次のマーケットから開きます。

- [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=RuanJiazhen.learn-by-diff)（VS Code）
- [Open VSX](https://open-vsx.org/extension/RuanJiazhen/learn-by-diff)（Cursor およびその他の Open VSX 系 IDE）

[手動インストール](https://github.com/RJiazhen/learn-by-diff/releases/latest)もできます。リリースページから `.vsix` をダウンロードし、拡張機能ビューにドロップしてください。

## コースを開く

Explorer の **LEARN BY DIFF** ビューのタイトルバーで「コースを開く」をクリックします（またはコマンドパレットで **LearnByDiff: コースを開く**）。

<img src="https://raw.githubusercontent.com/RJiazhen/learn-by-diff/main/apps/website/docs/images/open-course-button.png" alt="コースを開くボタン" style="max-width: 300px; display: block; margin: 0 auto;">

次のデモコース設定 URL を貼り付けて確定します。

```text
https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.yml
```

フォルダー選択で学習ワークスペースの保存先を選びます。コース関連ファイルはそのディレクトリにダウンロードされます。

ダウンロード後の学習ワークスペース：

<img src="https://raw.githubusercontent.com/RJiazhen/learn-by-diff/main/apps/website/docs/images/demo-course-screenshot.png" alt="ダウンロード後の学習ワークスペース" style="max-width: 300px; display: block; margin: 0 auto;">

拡張機能をインストール済みなら、次のリンクからワンクリックで開けます。

- [VS Code](vscode://RuanJiazhen.learn-by-diff/open?url=https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.yml)
- [Cursor](cursor://RuanJiazhen.learn-by-diff/open?url=https://github.com/RJiazhen/learn-by-diff/blob/main/examples/demo-course/.course-config/course.yml)

## 自分のやり方で学ぶ

コースを初めて開くと、第 1 章の**未開始**スナップショットがローカルに展開されます。デモコースでは [Live Preview](https://marketplace.visualstudio.com/items?itemName=ms-vscode.live-server) で `index.html` をプレビューできます。

Learn By Diff ビューには章一覧と次の機能があります。

| 操作                       | 内容                                                                     |
| -------------------------- | ------------------------------------------------------------------------ |
| **前の章 / 次の章**        | 隣接する章の未開始スナップショットへ切り替え                             |
| **章のドキュメントを開く** | その章のドキュメントを開く                                               |
| **未開始**                 | その章の開始スナップショットを適用                                       |
| **完了**                   | その章の完了スナップショットを適用                                       |
| **未開始フォルダーを開く** | その章の未開始スナップショットを独立フォルダーとしてワークスペースに追加 |
| **完了フォルダーを開く**   | その章の完了スナップショットを独立フォルダーとしてワークスペースに追加   |

コードはいつでも編集して、変更が機能にどう影響するかを確認できます。

章を展開すると、各機能を実現するために行われた変更も直接確認できます。

詳細はサイトの [機能](https://rjiazhen.github.io/learn-by-diff/ja/intro/features.html) を参照してください。

## コントリビュート

[コントリビューティングガイド](../CONTRIBUTING.md) を参照してください。
