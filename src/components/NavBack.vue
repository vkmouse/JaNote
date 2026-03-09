<script setup lang="ts">
import { useRouter } from "vue-router";
import ArrowLeftIcon from "../assets/icons/icon-arrow-left.svg?raw";

interface Props {
  onBack?: () => void;
}

const props = defineProps<Props>();
const router = useRouter();

// ── Handlers ───────────────────────────────────────────────
const handleBackClick = () => {
  if (props.onBack) props.onBack();
  else router.back();
};
</script>

<template>
  <button class="nav-btn" @click="handleBackClick" aria-label="返回">
    <span v-html="ArrowLeftIcon" class="icon"></span>
  </button>
</template>

<style scoped>
.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
  flex-shrink: 0;
}

.nav-btn:hover {
  background: var(--bg-hover, #f5f5f5);
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
