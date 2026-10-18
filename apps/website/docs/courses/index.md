---
title: Courses
---

<script setup>
import { data as courses } from "../courses.data";
</script>

# Courses

These are the courses in this repository’s [`packages/courses-config`](https://github.com/RJiazhen/learn-by-diff/tree/main/packages/courses-config). After you install LearnByDiff, open one with the VS Code or Cursor link.

<table>
  <thead>
    <tr>
      <th>Course</th>
      <th>Description</th>
      <th>Open</th>
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
