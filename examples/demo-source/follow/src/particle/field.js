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
