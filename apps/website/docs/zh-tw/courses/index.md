---
title: 課程
---

<script setup>
import { data as courses } from "../../courses.data";
</script>

# 課程

這裡列出本倉庫 [`packages/courses-config`](https://github.com/RJiazhen/learn-by-diff/tree/main/packages/courses-config) 中的課程。安裝 LearnByDiff 後，可以用 VS Code 或 Cursor 連結直接開啟。

<table>
  <thead>
    <tr>
      <th>課程</th>
      <th>說明</th>
      <th>開啟</th>
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
