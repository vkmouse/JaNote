<template>
  <div class="list-item">
    <slot />
  </div>
</template>

<style scoped>
.list-item {
  position: relative;
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
}
</style>
