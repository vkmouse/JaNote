<template>
  <nav v-show="!drawerOpen" class="bottom-tab-bar">
    <div class="inner">
      <div class="tab-capsule">
        <template v-for="(tab, i) in tabs" :key="tab.key">
          <button
            :class="['tab-btn', { active: isActive(tab.route) }]"
            @click="router.replace(tab.route)"
            :aria-label="tab.label"
          >
            <span class="tab-icon" v-html="tab.icon" />
            <span class="tab-label">{{ tab.label }}</span>
          </button>
          <div v-if="i < tabs.length - 1" class="capsule-divider" />
        </template>
      </div>

      <div v-if="showAddButton" class="add-capsule">
        <button
          class="add-btn"
          :disabled="addDisabled"
          @click="emit('add')"
          aria-label="新增"
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
import { inject } from "vue";
import type { Ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import iconDollarCircle from "../assets/icons/icon-dollar-circle.svg?raw";
import iconPieChart from "../assets/icons/icon-pie-chart.svg?raw";
import iconPiggyBank from "../assets/icons/new/icon-piggy-bank.svg?raw";

defineProps<{
  showAddButton?: boolean;
  addDisabled?: boolean;
}>();

const emit = defineEmits<{ add: [] }>();

const drawerOpen = inject<Ref<boolean>>("sideDrawerOpen");

const route = useRoute();
const router = useRouter();

const tabs = [
  {
    key: "transactions",
    label: "記帳",
    route: "/transactions",
    icon: iconDollarCircle,
  },
  {
    key: "summary",
    label: "總覽",
    route: "/transactions/summary",
    icon: iconPieChart,
  },
  {
    key: "budget",
    label: "預算",
    route: "/transactions/budget",
    icon: iconPiggyBank,
  },
];

const isActive = (tabRoute: string) => route.path === tabRoute;
</script>

<style scoped>
.bottom-tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 1) 40%
  );
  padding-top: 32px;
}

.inner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0 16px calc(24px + env(safe-area-inset-bottom));
}

/* Tab capsule — 大膠囊用 padding: 4px 讓小膠囊與邊框保持距離 */
.tab-capsule {
  display: flex;
  align-items: center;
  pointer-events: auto;
  background: var(--bg-page);
  border: 2px solid var(--border-primary);
  border-radius: 999px;
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.1),
    0 1px 4px rgba(0, 0, 0, 0.06);
  padding: 4px;
}

/* 每個 tab-btn 本身就是一個水平膠囊形 */
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
  font-weight: 600;
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

/* divider 只在非 active 相鄰時自然顯示，不影響膠囊邊距 */
.capsule-divider {
  width: 2px;
  height: 20px;
  background: var(--border-primary);
  margin: 0 2px;
  flex-shrink: 0;
  border-radius: 1px;
}

/* Add button capsule */
.add-capsule {
  display: flex;
  align-items: center;
  pointer-events: auto;
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
</style>
