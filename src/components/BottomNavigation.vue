<script setup lang="ts">
import { useRoute } from 'vue-router'
import SyncIcon from '../assets/icons/icon-sync.svg?raw'
import DashboardIcon from '../assets/icons/icon-dashboard.svg?raw'
import TransactionsIcon from '../assets/icons/icon-transactions.svg?raw'
import ShareIcon from '../assets/icons/icon-share.svg?raw'

const route = useRoute()

const navItems = [
  { to: '/', label: '同步', icon: SyncIcon },
  { to: '/dashboard', label: '總覽', icon: DashboardIcon },
  { to: '/transactions', label: '收支', icon: TransactionsIcon },
  { to: '/share', label: '共享', icon: ShareIcon },
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
/* 桌面版隱藏底部導覽列 */
.bottom-nav {
  display: none;
}

/* 手機版顯示底部導覽列 */
@media (max-width: 768px) {
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
    color: var(--text-secondary, #757575);
    transition: background 0.2s ease, color 0.2s ease, transform 0.1s ease;
    flex: 1;
    max-width: 80px;
  }

  .nav-link:hover,
  .nav-link:active {
    background: rgba(214, 106, 58, 0.08);
    color: var(--text-primary);
  }

  .nav-link.active {
    color: var(--janote-expense, #FFC952);
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
}
</style>
