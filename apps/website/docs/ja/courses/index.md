---
title: コース
---

<script setup>
import { data as courses } from "../../courses.data";
</script>

# コース

このリポジトリの [`packages/courses-config`](https://github.com/RJiazhen/learn-by-diff/tree/main/packages/courses-config) にあるコースです。LearnByDiff をインストールしたら、VS Code または Cursor のリンクから開けます。

<table>
  <thead>
    <tr>
      <th>コース</th>
      <th>説明</th>
      <th>開く</th>
    </tr>
  </thead>
  <tbody>
    <tr v-for="course in courses" :key="course.id">
      <td>
        <strong>{{ course.title }}</strong>
        <br />
        <code>{{ course.id }}</code>
      </td>
      <td>{{ course.description }}</td>
      <td>
        <a :href="course.blobUrl">course.jsonc</a>
        ·
        <a :href="course.vscodeUrl">VS Code</a>
        ·
        <a :href="course.cursorUrl">Cursor</a>
      </td>
    </tr>
  </tbody>
</table>
