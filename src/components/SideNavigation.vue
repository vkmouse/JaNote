<script setup lang="ts">
import { useRoute } from 'vue-router'
import SyncIcon from '../assets/icons/icon-sync.svg?raw'
import DashboardIcon from '../assets/icons/icon-dashboard.svg?raw'
import TransactionsIcon from '../assets/icons/icon-transactions.svg?raw'
import ShareIcon from '../assets/icons/icon-share.svg?raw'

const route = useRoute()

const navItems = [
  { to: '/', label: '同步頁面', icon: SyncIcon },
  { to: '/dashboard', label: '帳務總覽', icon: DashboardIcon },
  { to: '/transactions', label: '月收支', icon: TransactionsIcon },
  { to: '/share', label: '共享帳本', icon: ShareIcon },
]

const isActive = (path: string) => route.path === path
</script>

<template>
  <nav class="side-nav" aria-label="Side navigation">
    <div class="nav-brand">JaNote</div>
    <div class="nav-links">
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
    </div>
  </nav>
</template>

<style scoped>
.side-nav {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: var(--nav-width);
  padding: 24px 16px;
  background: var(--bg-elevated, #ffffff);
  border-right: 1px solid var(--border, #e0e0e0);
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 24px;
  z-index: 10;
}

.nav-brand {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.8px;
  color: var(--text-primary);
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
  border-radius: var(--radius-md);
  background: var(--bg-page);
  color: var(--text-primary);
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
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

/* 手機版隱藏側邊導覽列 */
@media (max-width: 768px) {
  .side-nav {
    display: none;
  }
}
</style>
