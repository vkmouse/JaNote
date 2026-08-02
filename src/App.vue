<script setup lang="ts">
import { ref, provide } from "vue";
import AccessGate from "./components/AccessGate.vue";
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

/**
 * AccessGate 驗證通過才會觸發（不管是掛載時用舊憑證驗證成功，還是使用者
 * 剛手動輸入成功），這裡才開始載入本地使用者資料、觸發第一次同步——
 * 因為 /api/sync 現在一定要有效的 access_token 才打得通，在驗證通過之前
 * 觸發只會白白吃一次 401。
 */
async function handleAuthenticated() {
  await userStore.loadUser();
  syncStatusStore.triggerSync();
}

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
</script>

<template>
  <AccessGate @authenticated="handleAuthenticated">
    <div class="app-shell">
      <SideNavigation :isOpen="sideDrawerOpen" @close="closeSideDrawer" />
      <main class="app-main">
        <router-view />
      </main>
      <!-- 先暫時將底部導覽註解 -->
      <!-- <BottomNavigation /> -->

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
  </AccessGate>
</template>
