---
title: 课程
---

<script setup lang="ts">
import { pickCourseDescription, type CourseDescription } from "../../courseDescription";
import { data as courses } from "../../courses.data";

/**
 * Returns the Simplified Chinese text for a course description.
 *
 * @param description - String or locale map from `course.jsonc`
 */
function courseText(description: CourseDescription): string {
  return pickCourseDescription(description, "zh-CN");
}
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
      <td>{{ courseText(course.description) }}</td>
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
