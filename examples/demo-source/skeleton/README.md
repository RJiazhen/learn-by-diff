# Canvas skeleton

Turn the empty page into a **full-window dark canvas** that clears itself every frame. Serve over `http://` when you check (ES modules).

## 1. `index.html` — add the canvas

In `<body>`, **above** the existing `<script>` tag, insert:

```html
<canvas></canvas>
```

Leave the script as the only JS entry: `<script src="src/main.js" type="module"></script>`.

## 2. `css/styles.css` — fill the viewport

On `html, body`, add `overflow: hidden` next to the existing rules. **After** that block, add:

```css
canvas {
  display: block;
  width: 100%;
  height: 100%;
}
```

## 3. New file `src/scene/canvas.js`

Create the folder `src/scene/` and this file. It owns the 2D context, resize, and a solid clear:

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

## 4. New file `src/scene/loop.js`

Same folder. The loop already walks a `particles` array (empty for now) so later chapters only fill that array:

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

## 5. `src/main.js` — fill `boot()`

**Do not delete `boot()`.** At the **top** of the file, add:

```js
import { frame } from "./scene/loop.js";
import { resize } from "./scene/canvas.js";
```

**Inside** `boot()`, replace the TODO with:

```js
window.addEventListener("resize", resize);
resize();
frame();
```

Keep the existing `boot();` call at the bottom.

## Check

A dark rectangle covers the window. Resize the window: the canvas should still fill it, with no gaps.
