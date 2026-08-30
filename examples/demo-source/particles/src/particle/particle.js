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
