---
title: 02 粒子漂移
outline: deep
---

# 02 粒子漂移

在深色舞台上铺满**漂移的圆点**，碰到边缘从对面回来。指针这一章仍然什么都不做。

`src/scene/loop.js` 里已经会对 `particles` 调用 `particle.step()` / `particle.draw()`。你要做的是加上粒子类型、填满数组，并在 `boot()` 里启动。

<div class="lbd-note">

对照扩展里 `skeleton` → `particles` 的 Diff，再按下面的文件补全。

</div>

## 1. 新建 `src/particle/particle.js`

创建 `src/particle/` 和这个文件：

```js
import { canvas, ctx } from "../scene/canvas.js";

/** One drifting dot on the canvas. */
export class Particle {
  /**
   * Places the particle at a random position with a small velocity.
   */
  constructor() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.vx = (Math.random() - 0.5) * 3.8;
    this.vy = (Math.random() - 0.5) * 3.8;
    this.radius = 1.6 + Math.random() * 2.2;
  }

  /**
   * Advances position and wraps at the canvas edges.
   */
  step() {
    this.x += this.vx;
    this.y += this.vy;
    this.wrap();
  }

  /**
   * Wraps this particle to the opposite edge when it leaves the canvas.
   */
  wrap() {
    if (this.x < 0) {
      this.x += canvas.width;
    } else if (this.x > canvas.width) {
      this.x -= canvas.width;
    }
    if (this.y < 0) {
      this.y += canvas.height;
    } else if (this.y > canvas.height) {
      this.y -= canvas.height;
    }
  }

  /**
   * Draws this particle as a filled circle.
   */
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#c9d7ff";
    ctx.fill();
  }
}
```

## 2. 新建 `src/particle/field.js`

同一目录。**改写**已有的 `particles` 数组，不要重新声明它：

```js
import { Particle } from "./particle.js";
import { particles } from "../scene/loop.js";

/**
 * Replaces the particle field with a new random set.
 */
export function createParticles() {
  particles.length = 0;
  for (let i = 0; i < 90; i += 1) {
    particles.push(new Particle());
  }
}
```

## 3. `src/main.js` — 从 `boot()` 启动粒子场

在文件**顶部**、现有的 `frame` / `resize` import **上面**增加：

```js
import { createParticles } from "./particle/field.js";
```

在 `boot()` 里，`resize();` **之后**、`frame();` **之前**加上：

```js
createParticles();
```

不要删掉 `boot()` 或 `frame()` 调用。

## 验收

用 `http://` 打开。浅色小点在画布上滑过，从对面边缘再出现。移动鼠标不应改变任何东西。

下一章：[跟随光标](/zh/demo/follow)
