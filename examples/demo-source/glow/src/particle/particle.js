import { canvas, ctx } from "../scene/canvas.js";
import { pointer } from "../pointer/pointer.js";

/** One drifting dot that seeks the pointer and paints a colored trail. */
export class Particle {
  /**
   * Places the particle at a random position with idle drift.
   */
  constructor() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.radius = 1.6 + Math.random() * 2.2;
    this.wander();
    this.vx = this.driftVx;
    this.vy = this.driftVy;
    this.orbitRadius = 76 + Math.random() * 16;
    this.orbitSpeed = 1.05 + Math.random() * 0.25;
    this.hue = 195 + Math.random() * 40;
  }

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

  /**
   * Eases onto a ring around the pointer at a capped speed; otherwise eases back to idle drift.
   */
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
   * Draws this particle with a constant glow; only hue varies per particle.
   */
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${this.hue}, 85%, 70%, 0.85)`;
    ctx.shadowColor = `hsla(${this.hue}, 90%, 68%, 0.9)`;
    ctx.shadowBlur = 10;
    ctx.fill();
  }
}
