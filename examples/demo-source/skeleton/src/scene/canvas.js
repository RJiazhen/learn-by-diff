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
 * Fills the canvas with the scene background.
 */
export function clear() {
  ctx.fillStyle = "#070b14";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
