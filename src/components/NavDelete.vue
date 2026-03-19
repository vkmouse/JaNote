<script setup lang="ts">
import { iconTrash } from "../utils/icons";

interface Props {
  active?: boolean;
}

defineProps<Props>();
defineEmits<{ click: [] }>();
</script>

<template>
  <button
    class="nav-btn"
    :class="{ 'nav-btn--active': active }"
    @click="$emit('click')"
    aria-label="刪除模式"
  >
    <span v-html="iconTrash" class="icon"></span>
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
  transition: color 0.2s;
}

.nav-btn--active .icon {
  color: #ef4444;
}

.nav-btn .icon :deep(svg) {
  width: 100%;
  height: 100%;
}
</style>
