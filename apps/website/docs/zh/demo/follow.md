---
title: 03 跟随光标
outline: deep
---

# 03 跟随光标

让圆点**绕着指针围成圆环**；指针离开页面后，再**散回空闲漂移**。

指针事件可参考 [MDN Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)。

<div class="lbd-note">

对照扩展里 `particles` → `follow` 的 Diff。这一章会改粒子的 `step()`，并加上 `src/pointer/`。

</div>

## 1. 新建 `src/pointer/pointer.js`

创建 `src/pointer/` 和这个文件。它记下指针位置，并在离开时让每个粒子散开：

```js
import { particles } from "../scene/loop.js";

export const pointer = { x: 0, y: 0, active: false };

/**
 * Records the pointer position in canvas coordinates.
 *
 * @param {PointerEvent} event
 */
export function onPointerMove(event) {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.active = true;
}

/**
 * Releases the swarm so particles scatter back into idle drift.
 */
export function onPointerLeave() {
  if (!pointer.active) {
    return;
  }
  pointer.active = false;
  for (const particle of particles) {
    particle.scatterFrom(pointer.x, pointer.y);
  }
}
```

## 2. `src/particle/particle.js` — 圆环运动

文件**顶部**保留 canvas import，并**增加**：

```js
import { pointer } from "../pointer/pointer.js";
```

在 **constructor** 里，设置完 `x`、`y`、`radius` 之后，不要再直接写死 `vx` / `vy`，改成空闲漂移加上各自的轨道半径和角速度：

```js
this.wander();
this.vx = this.driftVx;
this.vy = this.driftVy;
this.orbitRadius = 76 + Math.random() * 16;
this.orbitSpeed = 1.05 + Math.random() * 0.25;
```

在类上**增加**这两个方法（例如写在 constructor 后面）：

```js
  /**
   * Picks a new idle drift velocity.
   */
  wander() {
    this.driftVx = (Math.random() - 0.5) * 3.8;
    this.driftVy = (Math.random() - 0.5) * 3.8;
  }

  /**
   * Pushes this particle away from a point and assigns a new idle drift.
   *
   * @param {number} originX
   * @param {number} originY
   */
  scatterFrom(originX, originY) {
    const dx = this.x - originX;
    const dy = this.y - originY;
    const dist = Math.hypot(dx, dy) || 1;
    this.vx += (dx / dist) * 3.2;
    this.vy += (dy / dist) * 3.2;
    this.wander();
  }
```

**替换** `step()` 的函数体：指针激活时缓向圆环（限速，不要瞬移），末尾仍调用原来的 `wrap()`：

```js
  step() {
    if (pointer.active) {
      const dx = this.x - pointer.x;
      const dy = this.y - pointer.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      const radial = Math.max(-1.8, Math.min(1.8, (this.orbitRadius - dist) * 0.035));
      const tx = nx * radial - ny * this.orbitSpeed;
      const ty = ny * radial + nx * this.orbitSpeed;
      this.vx += (tx - this.vx) * 0.05;
      this.vy += (ty - this.vy) * 0.05;
    } else {
      this.vx += (this.driftVx - this.vx) * 0.04;
      this.vy += (this.driftVy - this.vy) * 0.04;
    }
    this.x += this.vx;
    this.y += this.vy;
    this.wrap();
  }
```

`wrap()` 和 `draw()` 保持不变。

## 3. `src/main.js` — 监听指针

在文件顶部和其他 import 放在一起：

```js
import { onPointerLeave, onPointerMove } from "./pointer/pointer.js";
```

在 `boot()` 里，`createParticles();` **之后**、`frame();` **之前**：

```js
window.addEventListener("pointermove", onPointerMove);
document.documentElement.addEventListener("pointerleave", onPointerLeave);
```

不要删除 `boot()`。

## 验收

用 `http://` 打开。移动鼠标：点应围成**空心圆环**，而不是堆在指针尖上。移出窗口后，它们应重新散开漂移。

下一章：[光晕与拖尾](/zh/demo/glow)
