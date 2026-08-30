# Glow and trails

The ring already follows the pointer. This chapter is **look**: a steady halo on every dot, and a short fading trail. Do not change `boot()` or add new script tags.

## 1. `src/scene/canvas.js` — `clear()`

Keep `resize()` as it is. **Replace the body of `clear()`** (the function at the bottom of the file) so each frame paints a translucent veil instead of a solid wipe:

```js
export function clear() {
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(7, 11, 20, 0.32)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
```

If the veil is too opaque, the tail vanishes at once. If it is too transparent, leftover light fills the screen.

## 2. `src/particle/particle.js` — hue and `draw()`

In the **constructor**, after `this.orbitSpeed = ...`, **add**:

```js
this.hue = 195 + Math.random() * 40;
```

**Replace the body of `draw()`** so the halo size and brightness stay fixed (only hue differs per particle):

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

Do **not** scale `radius` or `shadowBlur` from speed. That makes the rush toward the cursor look like a flash.

## 3. `src/particle/field.js` — a denser field (optional)

In `createParticles()`, you may raise the count from `90` to `120`:

```js
for (let i = 0; i < 120; i += 1) {
  particles.push(new Particle());
}
```

## 4. `css/styles.css` — background (optional)

On `html, body`, you may replace the solid `background: #070b14` with:

```css
background: radial-gradient(circle at 50% 40%, #1a2450 0%, #070b14 62%);
```

## Check

Serve over `http://`. Move the pointer: a colored ring with an **even** glow and light trails, not a white bloom. Leave the window: dots scatter, still with the same halo.
