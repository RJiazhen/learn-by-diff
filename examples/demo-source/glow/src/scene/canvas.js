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
 * Leaves a fading trail instead of erasing the previous frame.
 */
export function clear() {
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(7, 11, 20, 0.32)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
