<script setup lang="ts">
import SideNavigation from './components/SideNavigation.vue'
import BottomNavigation from './components/BottomNavigation.vue'
import UpdateModal from './components/UpdateModal.vue'
import { useServiceWorkerUpdate } from './utils/serviceWorkerUpdate'

// 初始化 Service Worker 更新邏輯
const { needRefresh, updateServiceWorker } = useServiceWorkerUpdate()

// 處理使用者確認更新
const handleUpdate = () => {
  updateServiceWorker()
}

// 處理使用者關閉更新提示
const handleClose = () => {
  needRefresh.value = false
}
</script>

<template>
  <div class="app-shell">
    <SideNavigation />
    <main class="app-main">
      <router-view />
    </main>
    <BottomNavigation />
    
    <!-- PWA 更新提示 Modal -->
    <UpdateModal 
      :show="needRefresh" 
      @update="handleUpdate"
      @close="handleClose"
    />
  </div>
</template>
