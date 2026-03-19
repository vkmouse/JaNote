<script setup lang="ts">
import { computed } from "vue";
import { useSyncStatusStore } from "../stores/syncStatusStore";
import {
  iconCloud,
  iconCloudCheck,
  iconCloudUpload,
  iconCloudAlert,
} from "../utils/icons";

const syncStatusStore = useSyncStatusStore();

const icon = computed(() => {
  switch (syncStatusStore.status) {
    case "syncing":
      return iconCloudUpload;
    case "success":
      return iconCloudCheck;
    case "error":
      return iconCloudAlert;
    default:
      return iconCloud;
  }
});
</script>

<template>
  <button
    class="nav-btn"
    :class="`nav-btn--${syncStatusStore.status}`"
    :disabled="!syncStatusStore.canSync"
    @click="syncStatusStore.triggerSync()"
    aria-label="同步"
  >
    <span v-html="icon" class="icon"></span>
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

.nav-btn:disabled {
  cursor: not-allowed;
}

.nav-btn:not(:disabled):active {
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

.nav-btn--syncing .icon {
  color: #3b82f6;
}

.nav-btn--success .icon {
  color: #22c55e;
}

.nav-btn--error .icon {
  color: #ef4444;
}

.nav-btn .icon :deep(svg) {
  width: 100%;
  height: 100%;
  fill: currentColor;
}
</style>
