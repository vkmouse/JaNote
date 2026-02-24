<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import TopNavigation from '../components/TopNavigation.vue'
import { syncQueueRepository } from '../repositories/syncQueueRepository'
import { syncMetaRepository } from '../repositories/syncMetaRepository'
import { userRepository } from '../repositories/userRepository'
import { categoryRepository } from '../repositories/categoryRepository'
import { transactionRepository } from '../repositories/transactionRepository'
import { performSync } from '../services/sync.service'

const apiBase = ref('/api')
const lastCursor = ref(0)
const userEmail = ref('-')
const activeQueueCount = ref(0)
const syncStatus = ref<'idle' | 'syncing' | 'success' | 'error'>('idle')
const lastSyncAt = ref('')
const isResetting = ref(false)

const isSyncing = computed(() => syncStatus.value === 'syncing')

onMounted(() => {
  refreshLocalState()
})

async function refreshLocalState() {
  lastCursor.value = await syncMetaRepository.getLastCursor()
  const queueItems = await syncQueueRepository.getAllOrdered()
  activeQueueCount.value = queueItems.length
  const user = await userRepository.get()
  if (user?.email) {
    userEmail.value = user.email
  }
}

async function syncNow() {
  syncStatus.value = 'syncing'

  try {
    const responseData = await performSync(apiBase.value)
    userEmail.value = responseData.user?.email || '-'
    await refreshLocalState()
    lastSyncAt.value = new Date().toLocaleString()
    syncStatus.value = 'success'
  } catch (error) {
    syncStatus.value = 'error'
    console.error('同步失敗:', error)
  }
}

async function clearAllData() {
  if (!confirm('確定要清空所有本地資料嗎？此操作無法復原。')) {
    return
  }

  try {
    await categoryRepository.deleteAll()
    await transactionRepository.deleteAll()
    await syncQueueRepository.clear()
    await syncMetaRepository.clear()
    await userRepository.clear()
    
    userEmail.value = '-'
    lastCursor.value = 0
    lastSyncAt.value = ''
    activeQueueCount.value = 0
    
    alert('已清空所有本地資料')
  } catch (error) {
    alert('清空資料失敗')
    console.error(error)
  }
}

async function resetServerData() {
  if (!confirm('確定要重置伺服器資料嗎？此操作會清空伺服器上的所有資料並重新初始化。')) {
    return
  }

  isResetting.value = true

  try {
    const response = await fetch(`${apiBase.value}/initdb`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    alert('伺服器資料已重置')
    console.log('重置結果:', data)
  } catch (error) {
    alert('重置失敗')
    console.error('重置失敗:', error)
  } finally {
    isResetting.value = false
  }
}
</script>

<template>
  <section class="sync-page">
    <TopNavigation>
      <template #title>同步管理</template>
    </TopNavigation>
    
    <div class="page-content">
      <header class="hero">
        <div class="brand">
          <p class="eyebrow">Sync Management</p>
          <h1>同步管理</h1>
          <p class="subtitle">管理本地與伺服器的同步狀態</p>
        </div>
        <div class="status-card">
          <div class="status-row">
            <span class="status-dot" :class="syncStatus"></span>
            <span class="status-text">
              {{ syncStatus === 'syncing' ? '同步中' : syncStatus === 'success' ? '就緒' : syncStatus === 'error' ? '同步失敗' : '待命' }}
            </span>
          </div>
          <div class="status-meta">
            <div>
              <span>Email</span>
              <strong class="email-text">{{ userEmail }}</strong>
            </div>
            <div>
              <span>Cursor</span>
              <strong>{{ lastCursor }}</strong>
            </div>
            <div>
              <span>Queue</span>
              <strong>{{ activeQueueCount }}</strong>
            </div>
            <div>
              <span>Last Sync</span>
              <strong class="sync-time">{{ lastSyncAt || '-' }}</strong>
            </div>
          </div>
        </div>
      </header>

      <section class="controls">
        <div class="control">
          <label>API Base</label>
          <input v-model="apiBase" placeholder="/api" />
        </div>
        <div class="control actions">
          <button class="btn-primary" :disabled="isSyncing" @click="syncNow">
            {{ isSyncing ? '同步中...' : '立即同步' }}
          </button>
          <button class="btn-primary btn-danger" :disabled="isResetting" @click="resetServerData">
            {{ isResetting ? '清空中...' : '清空伺服器資料' }}
          </button>
          <button class="btn-primary btn-danger" @click="clearAllData">清空本機資料</button>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.sync-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.page-content {
  flex: 1;
  background: var(--bg-page);
  color: var(--text-primary);
  padding: 36px 48px 60px;
  position: relative;
}

.hero {
  display: flex;
  gap: 32px;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 28px;
}

.brand h1 {
  font-size: 40px;
  margin: 4px 0 6px;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 12px;
  color: var(--text-secondary);
}

.subtitle {
  margin: 0;
  color: var(--text-secondary);
}

.status-card {
  background: var(--bg-page);
  border: 2px solid var(--border-primary);
  border-radius: 18px;
  padding: 18px 22px;
  min-width: 360px;
  flex-shrink: 0;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--text-disabled);
  flex-shrink: 0;
}

.status-dot.syncing {
  background: var(--janote-income);
  box-shadow: 0 0 12px rgba(71, 184, 224, 0.6);
}

.status-dot.success {
  background: var(--janote-expense);
  box-shadow: 0 0 12px rgba(255, 201, 82, 0.6);
}

.status-dot.error {
  background: var(--janote-action);
  box-shadow: 0 0 12px rgba(248, 113, 113, 0.6);
}

.status-text {
  font-weight: 600;
}

.status-meta {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.status-meta > div {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.status-meta span {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.status-meta strong {
  display: block;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.email-text {
  max-width: 100%;
}

.sync-time {
  font-size: 12px !important;
}

.controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  background: var(--bg-page);
  border: 2px solid var(--border-primary);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 28px;
}

.control {
  display: flex;
  flex-direction: column;
}

.control label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
  margin-bottom: 6px;
  display: block;
}

.sync-page input,
.sync-page select {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #e0e0e0;
  background: var(--bg-page);
  font-size: 14px;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  justify-content: flex-end;
}

.sync-page button {
  font-family: inherit;
  border: none;
  border-radius: 12px;
  padding: 12px 20px;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}

.btn-primary {
  background: var(--janote-expense);
  color: var(--text-primary);
  box-shadow: 0 2px 8px rgba(255, 201, 82, 0.3);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 201, 82, 0.4);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.btn-danger {
  background: var(--janote-action);
  color: var(--text-light);
  box-shadow: 0 2px 8px rgba(248, 113, 113, 0.3);
}

.btn-danger:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(248, 113, 113, 0.4);
}

@media (max-width: 900px) {
  .page-content {
    padding: 24px 16px 40px;
  }

  .hero {
    flex-direction: column;
    align-items: stretch;
    gap: 20px;
  }

  .brand h1 {
    font-size: 32px;
  }

  .status-card {
    width: 100%;
    min-width: 0;
    padding: 16px 18px;
  }

  .status-meta {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px 10px;
  }

  .status-meta strong {
    font-size: 13px;
  }

  .email-text {
    font-size: 12px !important;
  }

  .sync-time {
    font-size: 11px !important;
  }

  .controls {
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 14px;
  }

  .actions {
    gap: 10px;
  }

  .sync-page button {
    width: 100%;
    padding: 14px 20px;
  }
}

@media (max-width: 480px) {
  .page-content {
    padding: 20px 12px 40px;
  }

  .brand h1 {
    font-size: 28px;
  }

  .status-card {
    padding: 14px 16px;
  }

  .status-meta {
    gap: 12px 8px;
  }

  .status-meta strong {
    font-size: 12px;
  }
  
  .email-text {
    font-size: 11px !important;
  }

  .sync-time {
    font-size: 10px !important;
  }
}
</style>
