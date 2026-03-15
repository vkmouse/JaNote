<script setup lang="ts">
import { useRoute } from "vue-router";
import DollarCircleIcon from "../assets/icons/icon-dollar-circle.svg?raw";

interface Props {
  isOpen?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: false,
});

const emit = defineEmits<{
  close: [];
}>();

const route = useRoute();

const navItems = [
  { to: "/transactions", label: "記帳管理", icon: DollarCircleIcon },
];

const isActive = (path: string) => route.path.startsWith(path);

const handleClose = () => {
  emit("close");
};

const handleNavClick = () => {
  // 點擊導航項目後關閉側邊欄
  emit("close");
};
</script>

<template>
  <!-- 遮罩層 -->
  <Transition name="fade">
    <div
      v-if="isOpen"
      class="drawer-overlay"
      @click="handleClose"
      aria-hidden="true"
    ></div>
  </Transition>

  <!-- 側邊抽屜 -->
  <Transition name="slide">
    <nav v-if="isOpen" class="side-drawer" aria-label="Side navigation">
      <div class="drawer-header">
        <div class="nav-brand">JaNote</div>
        <button class="close-btn" @click="handleClose" aria-label="關閉選單">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="nav-links">
        <router-link
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-link"
          :class="{ active: isActive(item.to) }"
          @click="handleNavClick"
        >
          <span class="nav-icon" v-html="item.icon" aria-hidden="true"></span>
          <span class="nav-label">{{ item.label }}</span>
        </router-link>
      </div>
    </nav>
  </Transition>
</template>

<style scoped>
/* 遮罩層 */
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 998;
}

/* 側邊抽屜 */
.side-drawer {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 280px;
  max-width: 80vw;
  padding: 24px 16px;
  background: var(--bg-elevated, #ffffff);
  box-shadow: 2px 0 16px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  gap: 24px;
  z-index: 999;
  overflow-y: auto;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border, #e0e0e0);
}

.nav-brand {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.8px;
  color: var(--text-primary);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 6px;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-primary);
  transition: background-color 0.2s;
}

.close-btn:hover {
  background: var(--bg-hover, #f5f5f5);
}

.close-btn:active {
  background: var(--bg-active, #e0e0e0);
}

.nav-links {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--bg-page);
  color: var(--text-primary);
  transition:
    background 0.2s ease,
    color 0.2s ease;
  text-decoration: none;
}

.nav-link:hover {
  background: var(--janote-expense-light);
}

.nav-link.active {
  background: var(--janote-expense);
  font-weight: 600;
}

.nav-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.nav-icon :deep(svg) {
  width: 20px;
  height: 20px;
  stroke: currentColor;
}

.nav-label {
  font-size: 14px;
}

/* 過渡動畫 - 遮罩淡入淡出 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 過渡動畫 - 抽屜滑入滑出 */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(-100%);
}
</style>
