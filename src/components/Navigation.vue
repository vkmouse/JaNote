<script setup lang="ts">
import { useRoute } from 'vue-router'
import DashboardIcon from '../assets/icons/icon-dashboard.svg?raw'
import TransactionsIcon from '../assets/icons/icon-transactions.svg?raw'
import ShareIcon from '../assets/icons/icon-share.svg?raw'

const route = useRoute()

const navItems = [
  { to: '/dashboard', label: '帳務總覽頁', icon: DashboardIcon },
  { to: '/transactions', label: '月收支頁面', icon: TransactionsIcon },
  { to: '/share', label: '共享帳本頁', icon: ShareIcon },
]

const isActive = (path: string) => route.path === path
</script>

<template>
  <nav class="app-nav" aria-label="Main navigation">
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
.app-nav {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: var(--nav-width);
  padding: 24px 16px;
  background: var(--bg-elevated);
  border-right: 1px solid var(--border);
  box-shadow: var(--nav-shadow);
  display: flex;
  flex-direction: column;
  gap: 24px;
  z-index: 10;
}

.nav-brand {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.8px;
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
  color: var(--text-muted);
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.nav-link:hover {
  background: rgba(214, 106, 58, 0.12);
  color: var(--text);
  transform: translateX(2px);
}

.nav-link.active {
  background: var(--accent-soft);
  color: var(--accent);
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

@media (max-width: 768px) {
  .app-nav {
    left: 0;
    right: 0;
    top: auto;
    bottom: 0;
    width: 100%;
    height: 80px;
    border-right: none;
    border-top: 1px solid var(--border);
    padding: 12px 16px 16px;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }

  .nav-brand {
    display: none;
  }

  .nav-links {
    width: 100%;
    flex-direction: row;
    justify-content: space-around;
    gap: 12px;
  }

  .nav-link {
    flex-direction: column;
    gap: 6px;
    padding: 8px 10px;
    border-radius: var(--radius-md);
    flex: 1;
  }

  .nav-link:hover {
    transform: translateY(-2px);
  }

  .nav-label {
    display: none;
  }

  .nav-icon :deep(svg) {
    width: 22px;
    height: 22px;
  }
}
</style>
