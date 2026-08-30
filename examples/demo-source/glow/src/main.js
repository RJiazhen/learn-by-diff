import { createParticles } from "./particle/field.js";
import { onPointerLeave, onPointerMove } from "./pointer/pointer.js";
import { frame } from "./scene/loop.js";
import { resize } from "./scene/canvas.js";

/**
 * Starts the page: size the canvas and run the draw loop.
 */
function boot() {
  window.addEventListener("resize", resize);
  resize();
  createParticles();
  window.addEventListener("pointermove", onPointerMove);
  document.documentElement.addEventListener("pointerleave", onPointerLeave);
  frame();
}

boot();
