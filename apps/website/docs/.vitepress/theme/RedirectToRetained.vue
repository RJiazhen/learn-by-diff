<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vitepress";

/**
 * Replaces the section index URL with this locale’s first course-config page.
 */
function redirectToFirstPage(): void {
  const router = useRouter();
  const current = router.route.path.replace(/\/index(?:\.html)?$/, "").replace(/\/$/, "");
  void router.go(`${current}/retained`);
}

onMounted(redirectToFirstPage);
</script>

<template>
  <span />
</template>
