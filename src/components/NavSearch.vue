<script setup lang="ts">
import { useRouter } from "vue-router";
import { iconSearch } from "../utils/icons";

const router = useRouter();
</script>

<template>
  <button
    class="nav-btn"
    @click="router.push('/transactions/search')"
    aria-label="搜尋"
  >
    <span v-html="iconSearch" class="icon"></span>
  </button>
</template>

<style scoped>
.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
  flex-shrink: 0;
}

.nav-btn:active {
  background: var(--bg-active, #e0e0e0);
}

.nav-btn .icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: var(--text-primary, #333);
}

.nav-btn .icon :deep(svg) {
  width: 100%;
  height: 100%;
}
</style>
