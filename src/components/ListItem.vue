<script setup lang="ts">
import { ref, computed, inject, watch } from "vue";
import { listGroupKey } from "./ListGroup.vue";
import { iconTrash } from "../utils/icons";

const props = withDefaults(
  defineProps<{
    swipeable?: boolean;
  }>(),
  { swipeable: false }
);

const emit = defineEmits<{
  (e: "delete"): void;
}>();

// ── Exclusive state via ListGroup ────────────────────────────────────────────
const groupContext = inject(listGroupKey, null);
const itemId = Symbol();

// ── Swipe state ──────────────────────────────────────────────────────────────
const BUTTON_WIDTH = 72;
const SNAP_THRESHOLD = BUTTON_WIDTH / 3; // 24 px
const DIRECTION_LOCK_THRESHOLD = 8;

const translateX = ref(0);
const isDragging = ref(false);
const isOpen = ref(false);

// Non-reactive drag internals
let directionLocked: "h" | "v" | null = null;
let startX = 0;
let startY = 0;
let startTranslateX = 0;

const contentStyle = computed(() => ({
  transform: `translateX(${translateX.value}px)`,
  transition: isDragging.value
    ? "none"
    : "transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
}));

// ── Touch handlers ────────────────────────────────────────────────────────────
function onTouchStart(e: TouchEvent) {
  const t = e.touches[0];
  if (!t) return;
  startX = t.clientX;
  startY = t.clientY;
  startTranslateX = translateX.value;
  isDragging.value = true;
  directionLocked = null;
}

function onTouchMove(e: TouchEvent) {
  if (!isDragging.value) return;

  const t = e.touches[0];
  if (!t) return;
  const deltaX = t.clientX - startX;
  const deltaY = t.clientY - startY;

  if (directionLocked === "v") return;

  if (directionLocked === null) {
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX > DIRECTION_LOCK_THRESHOLD && absX > absY) {
      directionLocked = "h";
      groupContext?.setOpen(itemId);
    } else if (absY > DIRECTION_LOCK_THRESHOLD) {
      directionLocked = "v";
      isDragging.value = false;
      return;
    } else {
      return; // not yet determined
    }
  }

  // directionLocked === 'h'
  e.preventDefault();
  const next = startTranslateX + deltaX;
  translateX.value = Math.min(0, Math.max(-BUTTON_WIDTH, next));
}

function onTouchEnd() {
  if (directionLocked !== "h") {
    isDragging.value = false;
    return;
  }

  if (Math.abs(translateX.value) >= SNAP_THRESHOLD) {
    translateX.value = -BUTTON_WIDTH;
    isOpen.value = true;
    groupContext?.setOpen(itemId);
  } else {
    translateX.value = 0;
    isOpen.value = false;
  }

  isDragging.value = false;
}

// ── Auto-close when another item opens ───────────────────────────────────────
if (groupContext) {
  watch(
    () => groupContext.openItemId.value,
    (newId) => {
      if (newId !== itemId && isOpen.value) {
        translateX.value = 0;
        isOpen.value = false;
      }
    }
  );
}

// ── Content click → collapse ──────────────────────────────────────────────────
function onContentClick() {
  if (isOpen.value) {
    translateX.value = 0;
    isOpen.value = false;
    groupContext?.closeAll();
  }
}

// ── Delete button ─────────────────────────────────────────────────────────────
function onDeleteClick() {
  emit("delete");
  translateX.value = 0;
  isOpen.value = false;
  groupContext?.closeAll();
}
</script>

<template>
  <div class="list-item">
    <template v-if="swipeable">
      <div class="swipe-action" @click.stop="onDeleteClick">
        <span v-html="iconTrash" class="delete-icon" />
      </div>
      <div
        class="swipe-content"
        :style="contentStyle"
        @touchstart.passive="onTouchStart"
        @touchmove="onTouchMove"
        @touchend.passive="onTouchEnd"
        @click="onContentClick"
      >
        <slot />
      </div>
    </template>
    <slot v-else />
  </div>
</template>

<style scoped>
.list-item {
  position: relative;
  overflow: hidden;
  background: var(--bg-page);
}

.list-item:not(:last-child)::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 16px;
  right: 16px;
  height: 1px;
  background: #f0f0f0;
  z-index: 2;
}

/* ── Delete action (revealed on swipe) ─────────────────────── */
.swipe-action {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 72px;
  background: #ef4444;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  cursor: pointer;
}

.delete-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
}

.delete-icon :deep(svg) {
  width: 22px;
  height: 22px;
  stroke: #fff;
  fill: none;
}

/* ── Sliding content layer ─────────────────────────────────── */
.swipe-content {
  position: relative;
  z-index: 1;
  background: var(--bg-page);
  touch-action: pan-y;
}
</style>
