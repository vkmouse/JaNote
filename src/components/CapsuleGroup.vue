<template>
  <div class="capsule-group">
    <slot></slot>
  </div>
</template>

<style scoped>
.capsule-group {
  display: flex;
  align-items: center;
  pointer-events: auto;

  background: var(--bg-page);
  border: 2px solid var(--border-primary);
  border-radius: 999px;

  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.1),
    0 1px 4px rgba(0, 0, 0, 0.06);
}

:deep(.capsule-btn) {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  transition:
    background 0.15s ease,
    transform 0.12s ease;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
}

:deep(.capsule-btn:hover) {
  background: #f0f0f0;
}

:deep(.capsule-btn:active) {
  transform: scale(0.91);
  background: #e8e8e8;
}

:deep(.capsule-btn.add-btn) {
  background: var(--janote-action, #1a1a1a);
  color: #fff;
}

:deep(.capsule-btn.add-btn:hover) {
  opacity: 0.88;
  background: var(--janote-action, #1a1a1a);
}

:deep(.capsule-btn.add-btn:active) {
  transform: scale(0.91);
  opacity: 0.75;
}

:deep(.capsule-divider) {
  width: 2px;
  height: 20px;
  background: var(--border-primary);
  margin: 0 2px;
  flex-shrink: 0;
  border-radius: 1px;
}
</style>
