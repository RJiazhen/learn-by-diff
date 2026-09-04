---
title: 01 画布骨架
outline: deep
---

# 01 画布骨架

把空页面变成**铺满窗口的深色画布**，每一帧清屏。检查效果时请用 `http://` 打开（ES module）。

<div class="lbd-note">

在扩展里打开这一章的文件 Diff，对照官方 `start` → `skeleton`。本页是步骤说明，不是替你改文件。

</div>

## 1. `index.html` — 加上 canvas

在 `<body>` 里、现有 `<script>` **上面**插入：

```html
<canvas></canvas>
```

脚本保持唯一入口：`<script src="src/main.js" type="module"></script>`。

## 2. `css/styles.css` — 铺满视口

在 `html, body` 上，现有规则旁加上 `overflow: hidden`。**在该块之后**增加：

```css
canvas {
  display: block;
  width: 100%;
  height: 100%;
}
```

## 3. 新建 `src/scene/canvas.js`

创建目录 `src/scene/` 和这个文件。它负责 2D 上下文、尺寸和实心清屏：

```js
export const canvas = document.querySelector("canvas");
export const ctx = canvas.getContext("2d");

/**
 * Matches the canvas bitmap size to the viewport.
 */
export function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

/**
 * Fills the canvas with the scene background.
 */
export function clear() {
  ctx.fillStyle = "#070b14";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
```

## 4. 新建 `src/scene/loop.js`

同一目录。循环已经会遍历 `particles` 数组（现在是空的），后面几章只需填这个数组：

```js
import { clear } from "./canvas.js";

/** Particle field drawn each frame. Empty until `createParticles` runs. */
export const particles = [];

/**
 * Draws one animation frame.
 */
export function frame() {
  clear();
  for (const particle of particles) {
    particle.step();
    particle.draw();
  }
  requestAnimationFrame(frame);
}
```

## 5. `src/main.js` — 写完 `boot()`

**不要删除 `boot()`。** 在文件**顶部**增加：

```js
import { frame } from "./scene/loop.js";
import { resize } from "./scene/canvas.js";
```

在 `boot()` **里面**，把 TODO 换成：

```js
window.addEventListener("resize", resize);
resize();
frame();
```

底部已有的 `boot();` 调用保留。

## 验收

窗口被深色矩形铺满。缩放窗口时画布仍然铺满，没有留白。

下一章：[粒子漂移](/zh/demo/particles)
