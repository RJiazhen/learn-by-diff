<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { useData } from "vitepress";

defineProps<{
  /** Bundled URL of the looping demo clip. */
  src: string;
}>();

/** Next-click labels for each site locale. `play` is shown while the loop is paused. */
const LOOP_VIDEO_LABELS: Record<string, { play: string; pause: string }> = {
  en: { play: "Play", pause: "Pause" },
  "zh-CN": { play: "播放", pause: "暂停" },
  ja: { play: "再生", pause: "一時停止" },
  "zh-TW": { play: "播放", pause: "暫停" },
};

const { lang } = useData();
const videoRef = ref<HTMLVideoElement | null>(null);
/** Optimistic playback flag so a second click pauses before `play()` resolves. */
const playing = ref(true);
/** True for one second after a finger tap resumes playback, so the pause icon can show without hover. */
const touchPauseHint = ref(false);

const actionLabel = computed(() => loopVideoActionLabel(lang.value, playing.value));

let suppressClick = false;
let touchPauseHintTimer = 0;

/**
 * Toggles playback on a finger lift and ignores the click that follows.
 * Resuming shows the pause icon for one second, because a touch has no hover.
 *
 * @param event - Pointer release on the clip frame
 */
function onFramePointerUp(event: PointerEvent): void {
  if (event.pointerType !== "touch") {
    return;
  }
  suppressClick = true;
  const willResume = !playing.value;
  togglePlayback();
  if (willResume) {
    showTouchPauseHint();
  }
}

/**
 * Toggles playback for a mouse click or keyboard activation.
 * Skips the click that a finger tap already handled.
 */
function onFrameClick(): void {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  togglePlayback();
}

/**
 * Shows the pause icon, then hides it one second after a touch resume.
 */
function showTouchPauseHint(): void {
  window.clearTimeout(touchPauseHintTimer);
  touchPauseHint.value = true;
  touchPauseHintTimer = window.setTimeout(hideTouchPauseHint, 1000);
}

/**
 * Hides the touch pause icon and cancels a pending hide.
 */
function hideTouchPauseHint(): void {
  window.clearTimeout(touchPauseHintTimer);
  touchPauseHintTimer = 0;
  touchPauseHint.value = false;
}

/**
 * Pauses a playing loop, or resumes a paused one.
 * If `play()` is rejected, the control stays on the paused state.
 */
function togglePlayback(): void {
  const video = videoRef.value;
  if (!video) {
    return;
  }
  if (playing.value) {
    playing.value = false;
    hideTouchPauseHint();
    video.pause();
    return;
  }
  playing.value = true;
  void video.play().catch(onPlayRejected);
}

/**
 * Toggles the focused clip on Enter or Space without scrolling the page.
 *
 * @param event - Key press while the clip is focused
 */
function onClipKeydown(event: KeyboardEvent): void {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }
  event.preventDefault();
  onFrameClick();
}

/**
 * Marks the clip as playing after the media element starts.
 */
function onClipPlay(): void {
  playing.value = true;
}

/**
 * Marks the clip as paused after the media element stops.
 */
function onClipPause(): void {
  playing.value = false;
}

/**
 * Marks the clip paused when the browser refuses to start playback.
 */
function onPlayRejected(): void {
  playing.value = false;
  hideTouchPauseHint();
}

onUnmounted(hideTouchPauseHint);

/**
 * Returns the locale label for the action the next click will take.
 *
 * @param pageLang - VitePress page language
 * @param isPlaying - Whether the loop is currently playing
 */
function loopVideoActionLabel(pageLang: string, isPlaying: boolean): string {
  const labels = LOOP_VIDEO_LABELS[pageLang] ?? LOOP_VIDEO_LABELS.en;
  return isPlaying ? labels.pause : labels.play;
}
</script>

<template>
  <div
    class="lbd-loop-video-frame"
    :data-paused="playing ? 'false' : 'true'"
    :data-pause-hint="touchPauseHint ? 'true' : 'false'"
    @pointerup="onFramePointerUp"
    @click="onFrameClick"
  >
    <video
      ref="videoRef"
      class="lbd-loop-video"
      :src="src"
      :aria-label="actionLabel"
      autoplay
      muted
      loop
      playsinline
      tabindex="0"
      @play="onClipPlay"
      @pause="onClipPause"
      @keydown="onClipKeydown"
    />
    <span class="lbd-loop-video-badge" aria-hidden="true" />
  </div>
</template>

<style scoped>
.lbd-loop-video-frame {
  position: relative;
  margin: 1rem 0;
  cursor: pointer;
  line-height: 0;
  touch-action: manipulation;
}

.lbd-loop-video {
  display: block;
  width: 100%;
  height: auto;
  cursor: pointer;
}

.lbd-loop-video:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 3px;
}

.lbd-loop-video-badge {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 3.25rem;
  height: 3.25rem;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: rgb(0 0 0 / 55%) center / 1.35rem no-repeat;
  pointer-events: none;
  opacity: 0;
}

@media (hover: hover) and (pointer: fine) {
  .lbd-loop-video-frame[data-paused="false"]:has(.lbd-loop-video:hover) .lbd-loop-video-badge {
    opacity: 1;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='white' d='M6 5h4v14H6zm8 0h4v14h-4z'/%3E%3C/svg%3E");
  }
}

.lbd-loop-video-frame[data-paused="false"][data-pause-hint="true"] .lbd-loop-video-badge {
  opacity: 1;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='white' d='M6 5h4v14H6zm8 0h4v14h-4z'/%3E%3C/svg%3E");
}

.lbd-loop-video-frame[data-paused="true"] .lbd-loop-video-badge {
  opacity: 1;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='white' d='M8 5.5v13l11-6.5z'/%3E%3C/svg%3E");
}
</style>
