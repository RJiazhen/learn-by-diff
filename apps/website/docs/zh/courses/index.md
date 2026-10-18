---
title: 课程
---

<script setup>
import { data as courses } from "../../courses.data";
</script>

# 课程

这里列出本仓库 [`packages/courses-config`](https://github.com/RJiazhen/learn-by-diff/tree/main/packages/courses-config) 中的课程。安装 LearnByDiff 后，可以用 VS Code 或 Cursor 链接直接打开。

<table>
  <thead>
    <tr>
      <th>课程</th>
      <th>说明</th>
      <th>打开</th>
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
