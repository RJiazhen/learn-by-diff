<script setup lang="ts">
/**
 * Keeps every native `<img>` attribute and listener in fallthrough attrs
 * so the template can place them on the rendered image.
 */
defineOptions({
  inheritAttrs: false,
});
</script>

<template>
  <img v-bind="$attrs" class="lbd-doc-image" />
</template>

<style scoped>
.lbd-doc-image {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 400px;
  margin: 1rem auto;
  object-fit: contain;
}
</style>
