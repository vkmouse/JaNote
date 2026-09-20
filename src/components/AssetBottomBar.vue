<template>
  <nav v-show="!drawerOpen" class="asset-bottom-bar" aria-label="資產導覽">
    <div class="inner">
      <div class="tab-capsule">
        <template v-for="(slot, i) in slots" :key="slot.key">
          <button
            v-if="'route' in slot"
            type="button"
            :class="['tab-btn', { active: isActive(slot.route) }]"
            :aria-label="slot.label"
            :aria-current="isActive(slot.route) ? 'page' : undefined"
            @click="navigateToTab(slot)"
          >
            <span class="tab-icon" v-html="slot.icon" />
            <span class="tab-label">{{ slot.label }}</span>
          </button>
          <div v-else class="tab-slot" aria-hidden="true" />
          <div v-if="i < slots.length - 1" class="capsule-divider" />
        </template>
      </div>

      <div class="add-capsule">
        <button
          type="button"
          class="add-btn"
          :disabled="isViewingShared"
          aria-label="新增"
          @click="router.push('/assets/new')"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { inject, computed } from "vue";
import type { Ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { iconChartLineUp, iconPieChart } from "../utils/icons";
import { useUserStore } from "../stores/userStore";

// BottomTabBar 的分頁與新增路徑綁定記帳，資產頁的底部列因此獨立實作
const userStore = useUserStore();
const isViewingShared = computed(() => userStore.isViewingShared);

const drawerOpen = inject<Ref<boolean>>("sideDrawerOpen");

const route = useRoute();
const router = useRouter();

type Tab = { key: string; label: string; route: string; icon: string };
type ReservedSlot = { key: string };

const SLOT_COUNT = 4;

const tabs: Tab[] = [
  { key: "assets", label: "資產", route: "/assets", icon: iconPieChart },
  {
    key: "trend",
    label: "趨勢",
    route: "/assets/trend",
    icon: iconChartLineUp,
  },
];

// 固定四格，右側「＋」才會和記帳頁同位置；其餘格子尚未規劃，先佔位
const slots: (Tab | ReservedSlot)[] = [
  ...tabs,
  ...Array.from({ length: SLOT_COUNT - tabs.length }, (_, i) => ({
    key: `reserved-${i}`,
  })),
];

const isActive = (tabRoute: string) => route.path === tabRoute;

function navigateToTab(tab: Tab): void {
  if (isActive(tab.route)) return;
  router.replace(tab.route);
}
</script>

<style scoped>
.asset-bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: linear-gradient(to bottom, transparent 0%, var(--bg-page) 40%);
  padding-top: 32px;
}

.inner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0 16px calc(24px + env(safe-area-inset-bottom));
}

.tab-capsule {
  display: flex;
  align-items: center;
  background: var(--bg-page);
  border: 2px solid var(--border-primary);
  border-radius: 999px;
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.1),
    0 1px 4px rgba(0, 0, 0, 0.06);
  padding: 4px;
}

.tab-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: 46px;
  padding: 0 12px;
  min-width: 56px;
  border-radius: 999px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--text-primary);
  transition:
    background 0.15s ease,
    transform 0.12s ease,
    color 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.tab-btn:active {
  background: var(--janote-expense-light);
  transform: scale(0.91);
}

.tab-btn.active {
  background: var(--janote-expense);
  color: var(--text-on-expense);
  font-weight: 600;
}

.tab-btn:focus-visible {
  outline: 2px solid var(--text-primary);
  outline-offset: 2px;
}

/* 寬高與 tab-btn 一致，膠囊總寬才會和記帳頁相同 */
.tab-slot {
  flex-shrink: 0;
  width: 56px;
  height: 46px;
}

.tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
}

.tab-icon :deep(svg) {
  width: 22px;
  height: 22px;
}

.tab-label {
  font-size: 12px;
  white-space: nowrap;
}

.capsule-divider {
  width: 2px;
  height: 20px;
  background: var(--border-primary);
  margin: 0 2px;
  flex-shrink: 0;
  border-radius: 1px;
}

.add-capsule {
  display: flex;
  align-items: center;
  background: var(--bg-page);
  border: 2px solid var(--border-primary);
  border-radius: 999px;
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.1),
    0 1px 4px rgba(0, 0, 0, 0.06);
}

.add-btn {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: none;
  background: var(--janote-action, #1a1a1a);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    opacity 0.15s ease,
    transform 0.12s ease;
  -webkit-tap-highlight-color: transparent;
}

.add-btn:active {
  transform: scale(0.91);
  opacity: 0.75;
}

.add-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .tab-btn,
  .add-btn {
    transition: none;
  }
}
</style>
