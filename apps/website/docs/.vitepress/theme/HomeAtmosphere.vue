<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useData } from "vitepress";

const { frontmatter, isDark } = useData();
const canvasRef = ref<HTMLCanvasElement | null>(null);

let animationFrame = 0;
let resizeObserver: ResizeObserver | undefined;
let particles: Particle[] = [];
let width = 0;
let height = 0;
let reducedMotion = false;

/** One drifting dot used by the home atmosphere canvas. */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
}

/**
 * True when the current page uses the VitePress home layout.
 */
function isHome(): boolean {
  return frontmatter.value.layout === "home";
}

/**
 * Builds a fresh field of slow-drifting particles for the given canvas size.
 */
function createParticles(count: number): Particle[] {
  const next: Particle[] = [];
  for (let i = 0; i < count; i += 1) {
    next.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.28,
      vy: (Math.random() - 0.5) * 0.22,
      radius: 1.1 + Math.random() * 1.8,
      alpha: 0.18 + Math.random() * 0.28,
    });
  }
  return next;
}

/**
 * Matches the canvas bitmap to the atmosphere container size.
 */
function resizeCanvas(canvas: HTMLCanvasElement): void {
  const parent = canvas.parentElement;
  if (parent === null) {
    return;
  }
  const rect = parent.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(1, Math.floor(rect.width));
  height = Math.max(1, Math.floor(rect.height));
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${String(width)}px`;
  canvas.style.height = `${String(height)}px`;
  const ctx = canvas.getContext("2d");
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  const count = Math.min(70, Math.max(28, Math.floor((width * height) / 28000)));
  particles = createParticles(count);
}

/**
 * Draws one animation frame of the particle field.
 */
function paint(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    return;
  }
  ctx.clearRect(0, 0, width, height);
  const fill = isDark.value ? "61, 186, 133" : "0, 117, 76";
  const link = isDark.value ? "rgba(61, 186, 133, 0.12)" : "rgba(0, 117, 76, 0.1)";

  for (let i = 0; i < particles.length; i += 1) {
    const a = particles[i];
    for (let j = i + 1; j < particles.length; j += 1) {
      const b = particles[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 120) {
        ctx.strokeStyle = link;
        ctx.globalAlpha = (1 - dist / 120) * 0.55;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
  }

  ctx.globalAlpha = 1;
  for (const particle of particles) {
    if (!reducedMotion) {
      particle.x += particle.vx;
      particle.y += particle.vy;
      if (particle.x < -8) {
        particle.x = width + 8;
      } else if (particle.x > width + 8) {
        particle.x = -8;
      }
      if (particle.y < -8) {
        particle.y = height + 8;
      } else if (particle.y > height + 8) {
        particle.y = -8;
      }
    }
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${fill}, ${String(particle.alpha)})`;
    ctx.fill();
  }
}

/**
 * Starts the canvas loop and resize handling for the home atmosphere.
 */
function startAtmosphere(canvas: HTMLCanvasElement): void {
  reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  resizeCanvas(canvas);
  paint(canvas);

  /**
   * Schedules the next paint while the home atmosphere is mounted.
   */
  const tick = (): void => {
    paint(canvas);
    if (!reducedMotion) {
      animationFrame = window.requestAnimationFrame(tick);
    }
  };
  if (!reducedMotion) {
    animationFrame = window.requestAnimationFrame(tick);
  }

  resizeObserver = new ResizeObserver(() => {
    resizeCanvas(canvas);
    paint(canvas);
  });
  if (canvas.parentElement !== null) {
    resizeObserver.observe(canvas.parentElement);
  }
}

/**
 * Stops the canvas loop and releases resize observation.
 */
function stopAtmosphere(): void {
  window.cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  resizeObserver?.disconnect();
  resizeObserver = undefined;
  particles = [];
}

onMounted(() => {
  watch(
    [() => isHome(), canvasRef, isDark],
    ([home, canvas]) => {
      stopAtmosphere();
      if (home && canvas !== null) {
        startAtmosphere(canvas);
      }
    },
    { immediate: true, flush: "post" },
  );
});

onUnmounted(() => {
  stopAtmosphere();
});
</script>

<template>
  <div v-if="isHome()" class="lbd-home-atmosphere" aria-hidden="true">
    <div class="lbd-home-atmosphere__blobs">
      <span class="lbd-home-atmosphere__blob lbd-home-atmosphere__blob--a" />
      <span class="lbd-home-atmosphere__blob lbd-home-atmosphere__blob--b" />
      <span class="lbd-home-atmosphere__blob lbd-home-atmosphere__blob--c" />
    </div>
    <div class="lbd-home-atmosphere__grid" />
    <div class="lbd-home-atmosphere__sheen" />
    <canvas ref="canvasRef" class="lbd-home-atmosphere__canvas" />
  </div>
</template>
