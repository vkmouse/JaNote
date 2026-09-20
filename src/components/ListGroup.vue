<script setup lang="ts">
import { provideOwnListGroupContextIfMissing } from "../composables/useSharedSwipeContext";

// If a parent (e.g. the page) already provided a shared context, reuse it.
// Otherwise create an isolated context scoped to this group only.
provideOwnListGroupContextIfMissing();
</script>

<template>
  <div class="list-group">
    <div class="list-group-header">
      <slot name="header-left" />
      <slot name="header-right" />
    </div>
    <slot />
  </div>
</template>

<style scoped>
.list-group {
  background: var(--bg-page);
  border: 2px solid var(--border-primary);
  border-radius: 12px;
  overflow: hidden;
}

.list-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 2px solid var(--border-primary);
  color: var(--text-primary);
}
</style>
