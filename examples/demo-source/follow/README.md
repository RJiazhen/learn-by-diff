# Follow the cursor

Make the dots **orbit the pointer in a ring**, and **scatter back to idle drift** when the pointer leaves the page.

Pointer events: [MDN Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events).

## 1. New file `src/pointer/pointer.js`

Create `src/pointer/` and this file. It stores the pointer and tells each particle to scatter on leave:

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

## 2. `src/particle/particle.js` — ring motion

At the **top**, keep the canvas import and **add**:

```js
import { pointer } from "../pointer/pointer.js";
```

In the **constructor**, after setting `x`, `y`, and `radius`, replace the raw `vx` / `vy` assignments with idle drift plus a personal orbit radius/speed:

```js
this.wander();
this.vx = this.driftVx;
this.vy = this.driftVy;
this.orbitRadius = 76 + Math.random() * 16;
this.orbitSpeed = 1.05 + Math.random() * 0.25;
```

**Add** these two methods on the class (for example after the constructor):

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

**Replace** the body of `step()` so it eases toward a ring around the pointer (capped speed — no sudden dash). Keep the existing `wrap()` call at the end:

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

Leave `wrap()` and `draw()` as they are.

## 3. `src/main.js` — listen for the pointer

At the **top**, add this import next to the others:

```js
import { onPointerLeave, onPointerMove } from "./pointer/pointer.js";
```

**Inside** `boot()`, after `createParticles();` and **before** `frame();`, add:

```js
window.addEventListener("pointermove", onPointerMove);
document.documentElement.addEventListener("pointerleave", onPointerLeave);
```

Do not remove `boot()`.

## Check

Serve over `http://`. Move the mouse: dots should form a **hollow ring** around the cursor, not a clump on the tip. Leave the window: they should drift apart again.
