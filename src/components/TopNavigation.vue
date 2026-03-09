<script setup lang="ts">
</script>

<template>
  <header class="top-nav">
    <div class="nav-left">
      <slot name="left"></slot>
    </div>
    <div class="nav-center">
      <slot name="center"></slot>
    </div>
    <div class="nav-right">
      <slot name="right"></slot>
    </div>
  </header>
  <!-- 佔位元素，撐開 fixed nav 下方的空間 -->
  <div class="top-nav-spacer" aria-hidden="true"></div>
</template>

<style scoped>
.top-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: calc(64px + env(safe-area-inset-top));
  padding-top: env(safe-area-inset-top); /* iPhone 瀏海 / 靈動島安全區域 */
  background: var(--bg-elevated, #ffffff);
  border-bottom: 1px solid var(--border, #e0e0e0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: end; /* 因為 padding-top 推高，改用 end 讓內容對齊底部內容區 */
  padding-bottom: 0;
  padding-left: 24px;
  padding-right: 24px;
  z-index: 9;

  /* 修復 iOS overscroll 時頂部露出背景色的問題 */
  /* fixed 元素本身不受橡皮筋影響，但需確保背景不透明 */
  -webkit-backface-visibility: hidden; /* 避免 iOS 渲染閃爍 */
  backface-visibility: hidden;
}

/* 內容行高度固定 64px，align-items: end 讓三欄對齊內容底部 */
.nav-left,
.nav-center,
.nav-right {
  height: 64px;
  display: flex;
  align-items: center;
}

.nav-left {
  justify-content: flex-start;
}

.nav-center {
  justify-content: center;
  min-width: 0;
  overflow: hidden;
}

.nav-right {
  justify-content: flex-end;
}

/* 佔位元素：高度與 nav 相同，避免頁面內容被 fixed nav 遮住 */
.top-nav-spacer {
  height: calc(64px + env(safe-area-inset-top));
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .top-nav {
    height: calc(56px + env(safe-area-inset-top));
    padding-left: 16px;
    padding-right: 16px;
  }

  .nav-left,
  .nav-center,
  .nav-right {
    height: 56px;
  }

  .top-nav-spacer {
    height: calc(56px + env(safe-area-inset-top));
  }
}
</style>