<template>
  <nav class="bottom-nav">
    <div class="nav-left">
      <slot name="left"></slot>
    </div>
    <div class="nav-center">
      <slot name="center"></slot>
    </div>
    <div class="nav-right">
      <slot name="right"></slot>
    </div>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: calc(32px + env(safe-area-inset-bottom)) 16px;
  z-index: 1000;
  pointer-events: none;
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 1) 100%);
}

.nav-left {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.nav-center {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.nav-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
</style>
