<script setup lang="ts">
// TopNavigation component - accepts slots for custom content per page
</script>

<template>
  <header class="top-nav">
    <slot>
      <!-- 默認內容：頁面標題 -->
      <h1 class="page-title"><slot name="title">JaNote</slot></h1>
    </slot>
    <div v-if="$slots.actions" class="nav-actions">
      <slot name="actions"></slot>
    </div>
  </header>
</template>

<style scoped>
.top-nav {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: var(--bg-elevated, #ffffff);
  border-bottom: 1px solid var(--border, #e0e0e0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
  z-index: 9;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

@media (max-width: 768px) {
  .top-nav {
    height: 56px;
    padding: 0 16px;
  }

  .page-title {
    font-size: 18px;
  }
}
</style>
