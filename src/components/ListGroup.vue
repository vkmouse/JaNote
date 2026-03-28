<script lang="ts">
import type { InjectionKey, Ref } from "vue";
import { ref, readonly, provide, inject } from "vue";

export type ListGroupContext = {
  openItemId: Readonly<Ref<symbol | null>>;
  setOpen: (id: symbol) => void;
  closeAll: () => void;
};

export const listGroupKey: InjectionKey<ListGroupContext> = Symbol("listGroup");

/**
 * Call this once at the page (view) setup level to create a single shared
 * swipe context that spans all ListGroups on the page — ensuring only one
 * ListItem is open at a time across all groups (exclusive drawer).
 */
export function useSharedSwipeContext(): ListGroupContext {
  const openItemId = ref<symbol | null>(null);
  const ctx: ListGroupContext = {
    openItemId: readonly(openItemId),
    setOpen: (id: symbol) => { openItemId.value = id; },
    closeAll: () => { openItemId.value = null; },
  };
  provide(listGroupKey, ctx);
  return ctx;
}
</script>

<script setup lang="ts">
// If a parent (e.g. the page) already provided a shared context, reuse it.
// Otherwise create an isolated context scoped to this group only.
const parentCtx = inject(listGroupKey, null);

if (!parentCtx) {
  const openItemId = ref<symbol | null>(null);
  provide(listGroupKey, {
    openItemId: readonly(openItemId),
    setOpen: (id: symbol) => { openItemId.value = id; },
    closeAll: () => { openItemId.value = null; },
  });
}
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
