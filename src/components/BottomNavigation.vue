<script setup lang="ts">
import { useRoute } from 'vue-router'
import PieChartIcon from '../assets/icons/icon-pie-chart.svg?raw'
import DollarCircleIcon from '../assets/icons/icon-dollar-circle.svg?raw'

const route = useRoute()

const navItems = [
  { to: '/transactions', label: '收支', icon: DollarCircleIcon },
  { to: '/transactions/summary', label: '總覽', icon: PieChartIcon },
]

const isActive = (path: string) => route.path === path
</script>

<template>
  <nav class="bottom-nav" aria-label="Bottom navigation">
    <router-link
      v-for="item in navItems"
      :key="item.to"
      :to="item.to"
      class="nav-link"
      :class="{ active: isActive(item.to) }"
    >
      <span class="nav-icon" v-html="item.icon" aria-hidden="true"></span>
      <span class="nav-label">{{ item.label }}</span>
    </router-link>
  </nav>
</template>

<style scoped>
/* 底部導覽列在所有設備上都顯示 */
.bottom-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 72px;
  background: var(--bg-elevated, #ffffff);
  border-top: 1px solid var(--border, #e0e0e0);
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 8px 16px 12px;
  z-index: 10;
}

.nav-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--bg-page);
  color: var(--text-primary);
  transition: background 0.2s ease, color 0.2s ease, transform 0.1s ease;
  flex: 1;
  max-width: 80px;
}

.nav-link:hover,
.nav-link:active {
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
  width: 24px;
  height: 24px;
  stroke: currentColor;
}

.nav-label {
  font-size: 12px;
  line-height: 1.2;
}
</style>
