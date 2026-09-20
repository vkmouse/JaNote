import type { InjectionKey, Ref } from "vue";
import { ref, readonly, provide, inject } from "vue";

export type ListGroupContext = {
  openItemId: Readonly<Ref<symbol | null>>;
  setOpen: (id: symbol) => void;
  closeAll: () => void;
};

export const listGroupKey: InjectionKey<ListGroupContext> = Symbol("listGroup");

function createListGroupContext(): ListGroupContext {
  const openItemId = ref<symbol | null>(null);
  return {
    openItemId: readonly(openItemId),
    setOpen: (id: symbol) => { openItemId.value = id; },
    closeAll: () => { openItemId.value = null; },
  };
}

/**
 * Call this once at the page (view) setup level to create a single shared
 * swipe context that spans all ListGroups on the page — ensuring only one
 * ListItem is open at a time across all groups (exclusive drawer).
 */
export function useSharedSwipeContext(): ListGroupContext {
  const ctx = createListGroupContext();
  provide(listGroupKey, ctx);
  return ctx;
}

/**
 * Used internally by ListGroup.vue: if a parent (e.g. the page) already
 * provided a shared context, reuse it. Otherwise create an isolated context
 * scoped to this group only.
 */
export function provideOwnListGroupContextIfMissing(): void {
  const parentCtx = inject(listGroupKey, null);
  if (!parentCtx) {
    provide(listGroupKey, createListGroupContext());
  }
}
