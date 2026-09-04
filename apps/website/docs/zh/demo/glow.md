---
title: 04 光晕与拖尾
outline: deep
---

# 04 光晕与拖尾

圆环已经会跟着指针走。这一章只改**观感**：每个点有稳定光晕，并留下很短的淡出拖尾。不要改 `boot()`，也不要加新的 script 标签。

<div class="lbd-note">

对照扩展里 `follow` → `glow` 的 Diff。扩展里本章的文档按钮仍打开快照中的 `docs.pdf`；本页是同一教程的网页版。

</div>

## 1. `src/scene/canvas.js` — `clear()`

`resize()` 保持不动。**替换 `clear()` 的函数体**（文件底部那个函数），让每一帧刷一层半透明罩，而不是实心清屏：

```js
export function clear() {
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(7, 11, 20, 0.32)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
```

罩太不透明，尾巴会立刻消失；太透明，残留光会铺满屏幕。

## 2. `src/particle/particle.js` — 色相和 `draw()`

在 **constructor** 里，`this.orbitSpeed = ...` **之后增加**：

```js
this.hue = 195 + Math.random() * 40;
```

**替换 `draw()` 的函数体**，光晕大小和亮度固定（只有色相因粒子而异）：

```js
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${this.hue}, 85%, 70%, 0.85)`;
    ctx.shadowColor = `hsla(${this.hue}, 90%, 68%, 0.9)`;
    ctx.shadowBlur = 10;
    ctx.fill();
  }
```

**不要**用速度去缩放 `radius` 或 `shadowBlur`。那样冲向光标时会闪成一团白。

## 3. `src/particle/field.js` — 更密的粒子场（可选）

在 `createParticles()` 里可以把数量从 `90` 提到 `120`：

```js
for (let i = 0; i < 120; i += 1) {
  particles.push(new Particle());
}
```

## 4. `css/styles.css` — 背景（可选）

在 `html, body` 上，可以把实心 `background: #070b14` 换成：

```css
background: radial-gradient(circle at 50% 40%, #1a2450 0%, #070b14 62%);
```

## 验收

用 `http://` 打开。移动指针：彩色圆环应有**均匀**光晕和浅色拖尾，而不是爆成白斑。移出窗口后粒子散开，光晕强度不变。

回到 [教程概览](/zh/demo/)。
