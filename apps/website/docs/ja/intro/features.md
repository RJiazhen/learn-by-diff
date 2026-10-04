---
title: 機能
outline: deep
---

# 機能

## コースを開く

現在のワークスペースにコースがない場合は **「コースを開く」** をクリックするか、コマンドパレットで **LearnByDiff: コースを開く** を実行します。

<img src="../../images/features-open-course.png" alt="コースを開く" style="height: 400px; width: auto; margin: 0 auto; display: block;"/>

一覧から公式コースを選ぶと開きます。course.jsonc のパスまたは URL を入力して確定することもできます。

## 章の切り替えと確認

コースを開くと、Explorer に **Learn By Diff** ビューが現れ、章一覧が表示されます。

<img src="../../images/features-chapter-switch-and-view.png" alt="章の切り替えと確認" style="height: 400px; width: auto; margin: 0 auto; display: block;"/>

Learn By Diff ビューでは、次のボタン操作ができます。

| 操作                       | 内容                                                                         |
| -------------------------- | ---------------------------------------------------------------------------- |
| **現在の章へスクロール**   | 現在の章へ移動する                                                           |
| **章を検索**               | タイトルまたは ID で章を探して一覧に表示（あいまい検索対応）                 |
| **章のドキュメントを開く** | その章のドキュメントを開く                                                   |
| **未開始** / **完了**      | ワークスペースのコードをその章の未開始または完了スナップショットに切り替える |

スナップショットを切り替えるときは、誤操作を防ぐため **現在のフォルダーを上書きするか** 確認されます。

## ファイル比較

<img src="../../images/features-file-compare.png" alt="ファイル比較" style="height: 400px; width: auto; margin: 0 auto; display: block;"/>

Learn By Diff ビューで章を展開すると変更一覧が出ます。ファイル名をクリックすると、ソース管理と同じ種類の差分が開きます。

## 章の比較

異なる章・状態のコードを並べて動かしたいときは、章の **「...」** ボタンから **「未開始フォルダーを開く」** または **「完了フォルダーを開く」** をクリックします。そのスナップショットがダウンロードされ、ワークスペースに別フォルダーとして追加されます。

<img src="../../images/features-chapter-compare.png" alt="章の比較" style="height: 400px; width: auto; margin: 0 auto; display: block;"/>
