<script setup lang="ts">
import { ref, provide, onMounted, watch } from "vue";
import SideNavigation from "./components/SideNavigation.vue";
import BottomNavigation from "./components/BottomNavigation.vue";
import ConfirmModal from "./components/ConfirmModal.vue";
import { useServiceWorkerUpdate } from "./utils/serviceWorkerUpdate";
import { useUserStore } from "./stores/userStore";
import { useSyncStatusStore } from "./stores/syncStatusStore";

// 側邊欄狀態管理
const sideDrawerOpen = ref(false);

const openSideDrawer = () => {
  sideDrawerOpen.value = true;
};

const closeSideDrawer = () => {
  sideDrawerOpen.value = false;
};

// 提供給子組件使用
provide("openSideDrawer", openSideDrawer);
provide("sideDrawerOpen", sideDrawerOpen);

// 初始化使用者狀態（全域，所有頁面共用）
const userStore = useUserStore();
const syncStatusStore = useSyncStatusStore();

// ── Auth 過期偵測 ─────────────────────────────────────────────
const authExpired = ref(false);

/** 呼叫 /api/health 探測 CF Access session 是否仍有效 */
async function checkAuth() {
  try {
    const res = await fetch("/api/health");
    // CF Access session 過期時，fetch 會 follow redirect 到外部登入頁
    if (!res.url.startsWith(window.location.origin)) {
      authExpired.value = true;
    }
  } catch {
    // 網路斷線，不觸發 auth 過期（離線情境）
  }
}

// 監聽同步狀態：若 sync 時才偵測到 auth 過期，同步觸發 banner
watch(
  () => syncStatusStore.status,
  (status) => {
    if (status === "auth_expired") {
      authExpired.value = true;
    }
  },
);

onMounted(async () => {
  await userStore.loadUser();
  // 啟動時先做 auth 探測，再執行同步
  await checkAuth();
  if (!authExpired.value) {
    syncStatusStore.triggerSync();
  }
});

// 初始化 Service Worker 更新邏輯
const { needRefresh, updateServiceWorker } = useServiceWorkerUpdate();

// 處理使用者確認更新
const handleUpdate = () => {
  updateServiceWorker();
};

// 處理使用者關閉更新提示
const handleClose = () => {
  needRefresh.value = false;
};

// 處理 auth 過期：在系統瀏覽器開啟 CF Access 登入流程
const handleAuthExpiredConfirm = () => {
  window.open("/", "_blank", "noopener");
};
</script>

<template>
  <div class="app-shell">
    <SideNavigation :isOpen="sideDrawerOpen" @close="closeSideDrawer" />
    <main class="app-main">
      <router-view />
    </main>
    <!-- 先暫時將底部導覽註解 -->
    <!-- <BottomNavigation /> -->

    <!-- Auth 過期提示 Modal -->
    <ConfirmModal
      :show="authExpired"
      title="登入已過期"
      message="請點選重新登入，完成驗證後即可繼續同步。"
      confirm-text="重新登入"
      cancel-text="稍後再說"
      @confirm="handleAuthExpiredConfirm"
      @cancel="authExpired = false"
    />

    <!-- PWA 更新提示 Modal -->
    <ConfirmModal
      :show="needRefresh"
      title="🎉 新版本可用"
      message="我們已經準備好新版本，包含功能改進和錯誤修正。是否立即更新？"
      confirm-text="立即更新"
      cancel-text="稍後再說"
      @confirm="handleUpdate"
      @cancel="handleClose"
    />
  </div>
</template>


