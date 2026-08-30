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
