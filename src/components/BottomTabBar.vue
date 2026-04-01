<template>
  <nav v-show="!drawerOpen" class="bottom-tab-bar">
    <div class="inner">
      <div class="tab-capsule">
        <template v-for="(tab, i) in tabs" :key="tab.key">
          <button
            :class="['tab-btn', { active: isActive(tab.route) }]"
            @click="navigateToTab(tab)"
            :aria-label="tab.label"
          >
            <span class="tab-icon" v-html="tab.icon" />
            <span class="tab-label">{{ tab.label }}</span>
          </button>
          <div v-if="i < tabs.length - 1" class="capsule-divider" />
        </template>
      </div>

      <div class="add-capsule">
        <button
          class="add-btn"
          :disabled="isViewingShared"
          @click="router.push('/transactions/new')"
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
import { inject, computed } from "vue";
import type { Ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { iconDollarCircle, iconPieChart, iconPiggyBank, iconTag } from "../utils/icons";
import { useUserStore } from "../stores/userStore";

const userStore = useUserStore();
const isViewingShared = computed(() => userStore.isViewingShared);

const drawerOpen = inject<Ref<boolean>>("sideDrawerOpen");

const route = useRoute();
const router = useRouter();

type Tab = { key: string; label: string; route: string; icon: string };

const tabs: Tab[] = [
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
  {
    key: "recurring",
    label: "固定",
    route: "/transactions/recurring",
    icon: iconTag,
  },
];

const isActive = (tabRoute: string) => route.path === tabRoute;

// ──────────────────────────────────────────────────────────
// 跨 Tab 日期 / 模式 / 類型上下文傳遞規則：
//  → 記帳（transactions）：永遠不帶 query，回到當前年月
//     例外：來源為 Budget/Summary 且為月份模式時，帶入 year+month
//  → 從記帳 → 預算/總覽：帶入 year+month 並強制 mode=monthly
//  → 預算 ↔ 總覽互換：帶入完整時間上下文（mode、type、year/month 或 start/end）
//  → 其他來源（如固定頁）→ 任意目標：單純路徑跳轉
// ──────────────────────────────────────────────────────────
function navigateToTab(tab: Tab): void {
  const currentPath = route.path;
  const q = route.query;

  // 切到記帳 tab
  if (tab.key === "transactions") {
    // 來源為預算或總覽且為月份模式：保留年月
    if (
      (currentPath === "/transactions/budget" || currentPath === "/transactions/summary") &&
      q.mode === "monthly" &&
      typeof q.year === "string" &&
      typeof q.month === "string"
    ) {
      router.replace({ path: tab.route, query: { year: q.year, month: q.month } });
    } else {
      // 其他情況（年度、自訂、其他來源）回當前日期，不帶 query
      router.replace(tab.route);
    }
    return;
  }

  // 從記帳 → 預算或總覽：帶入 year+month，強制 mode=monthly
  if (currentPath === "/transactions") {
    const year = typeof q.year === "string" ? q.year : String(new Date().getFullYear());
    const month = typeof q.month === "string" ? q.month : String(new Date().getMonth() + 1);
    router.replace({
      path: tab.route,
      query: { mode: "monthly", year, month },
    });
    return;
  }

  // 預算 ↔ 總覽互換：帶入完整時間上下文
  if (currentPath === "/transactions/budget" || currentPath === "/transactions/summary") {
    const mode = typeof q.mode === "string" ? q.mode : "monthly";
    const type = typeof q.type === "string" ? q.type : undefined;
    const timeQuery: Record<string, string> = { mode };
    if (type) timeQuery.type = type;
    if (mode === "monthly" || mode === "yearly") {
      if (typeof q.year === "string") timeQuery.year = q.year;
      if (mode === "monthly" && typeof q.month === "string") timeQuery.month = q.month;
    } else if (mode === "custom") {
      if (typeof q.start === "string") timeQuery.start = q.start;
      if (typeof q.end === "string") timeQuery.end = q.end;
    }
    router.replace({ path: tab.route, query: timeQuery });
    return;
  }

  // 其他來源：單純路徑跳轉
  router.replace(tab.route);
}
</script>

<style scoped>
.bottom-tab-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  pointer-events: auto;
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
