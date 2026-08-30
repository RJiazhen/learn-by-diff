# Particles

Fill the dark stage with **drifting dots** that wrap at the edges. The pointer still does nothing.

The animation loop in `src/scene/loop.js` already does `particle.step()` / `particle.draw()` on the `particles` array. You only add the particle type, fill that array, and start it from `boot()`.

## 1. New file `src/particle/particle.js`

Create `src/particle/` and this file:

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

## 2. New file `src/particle/field.js`

Same folder. Mutate the existing `particles` array (do not redeclare it):

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

## 3. `src/main.js` — start the field from `boot()`

At the **top**, add this import **above** the existing `frame` / `resize` imports:

```js
import { createParticles } from "./particle/field.js";
```

**Inside** `boot()`, after `resize();` and **before** `frame();`, add:

```js
createParticles();
```

Do not remove `boot()` or the `frame()` call.

## Check

Serve over `http://`. Pale dots should slide across the canvas and reappear on the opposite side. Moving the mouse should not change anything.
