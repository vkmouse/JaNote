<script setup lang="ts">
import { inject } from "vue";
import { iconBars3 } from "../utils/icons";

// ── 注入側邊欄打開方法 ────────────────────────────────────────
const openSideDrawer = inject<() => void>("openSideDrawer");

// ── Handlers ───────────────────────────────────────────────
const handleMenuClick = () => {
  if (openSideDrawer) openSideDrawer();
};
</script>

<template>
  <button class="nav-btn" @click="handleMenuClick" aria-label="選單">
    <span v-html="iconBars3" class="icon"></span>
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
