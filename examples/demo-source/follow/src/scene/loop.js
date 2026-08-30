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
