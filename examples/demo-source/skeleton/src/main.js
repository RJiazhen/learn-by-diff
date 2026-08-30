import { frame } from "./scene/loop.js";
import { resize } from "./scene/canvas.js";

/**
 * Starts the page: size the canvas and run the draw loop.
 */
function boot() {
  window.addEventListener("resize", resize);
  resize();
  frame();
}

boot();
