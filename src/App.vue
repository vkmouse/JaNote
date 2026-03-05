<script setup lang="ts">
import { ref, provide, onMounted } from "vue";
import SideNavigation from "./components/SideNavigation.vue";
import BottomNavigation from "./components/BottomNavigation.vue";
import UpdateModal from "./components/UpdateModal.vue";
import { useServiceWorkerUpdate } from "./utils/serviceWorkerUpdate";
import { useUserStore } from "./stores/userStore";

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

// 初始化使用者狀態（全域，所有頁面共用）
const userStore = useUserStore();
onMounted(() => {
  userStore.loadUser();
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
</script>

<template>
  <div class="app-shell">
    <SideNavigation :isOpen="sideDrawerOpen" @close="closeSideDrawer" />
    <main class="app-main">
      <router-view />
    </main>
    <!-- 先暫時將底部導覽註解 -->
    <!-- <BottomNavigation /> -->

    <!-- PWA 更新提示 Modal -->
    <UpdateModal
      :show="needRefresh"
      @update="handleUpdate"
      @close="handleClose"
    />
  </div>
</template>
