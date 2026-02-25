<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import TopNavigation from '../components/TopNavigation.vue'
import { syncQueueRepository } from '../repositories/syncQueueRepository'
import { syncMetaRepository } from '../repositories/syncMetaRepository'
import { userRepository } from '../repositories/userRepository'
import { categoryRepository } from '../repositories/categoryRepository'
import { userShareRepository } from '../repositories/userShareRepository'
import { syncService } from '../services/syncService'
import { transactionService } from '../services/transactionService'
import { userShareService } from '../services/userShareService'
import type { UserShare } from '../types'

const apiBase = ref('/api')
const lastCursor = ref(0)
const userId = ref('')
const userEmail = ref('-')
const activeQueueCount = ref(0)
const syncStatus = ref<'idle' | 'syncing' | 'success' | 'error'>('idle')
const lastSyncAt = ref('')
const isResetting = ref(false)

// 共享邀請相關
const inviteEmail = ref('')
const sentPendingInvites = ref<UserShare[]>([]) // 作為 owner 發出的 PENDING 邀請
const receivedPendingInvites = ref<UserShare[]>([]) // 作為 viewer 收到的 PENDING 邀請
const activeShares = ref<UserShare[]>([]) // ACTIVE 的共享
const isInviting = ref(false)
const operatingShareId = ref<string | null>(null)

const isSyncing = computed(() => syncStatus.value === 'syncing')

onMounted(() => {
  refreshLocalState()
})

async function refreshLocalState() {
  lastCursor.value = await syncMetaRepository.getLastCursor()
  const queueItems = await syncQueueRepository.getAllOrdered()
  activeQueueCount.value = queueItems.length
  const user = await userRepository.get()
  if (user?.id) {
    userId.value = user.id
  }
  if (user?.email) {
    userEmail.value = user.email
  }
  
  // 載入所有共享
  const allShares = await userShareRepository.getAll()
  const validShares = allShares.filter(share => share.is_deleted === 0)
  
  // 分類共享
  sentPendingInvites.value = validShares.filter(
    share => share.status === 'PENDING' && share.owner_id === userId.value
  )
  receivedPendingInvites.value = validShares.filter(
    share => share.status === 'PENDING' && share.viewer_id === userId.value
  )
  activeShares.value = validShares.filter(share => share.status === 'ACTIVE')
}

async function syncNow() {
  syncStatus.value = 'syncing'

  try {
    const responseData = await syncService.performSync(apiBase.value)
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
    await transactionService.deleteAllTransactions()
    await userShareService.deleteAllShares()
    await syncQueueRepository.clear()
    await syncMetaRepository.clear()
    await userRepository.clear()
    
    userId.value = ''
    userEmail.value = '-'
    lastCursor.value = 0
    lastSyncAt.value = ''
    activeQueueCount.value = 0
    sentPendingInvites.value = []
    receivedPendingInvites.value = []
    activeShares.value = []
    
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

async function sendInvite() {
  const email = inviteEmail.value.trim()
  
  if (!email) {
    alert('請輸入 Email 地址')
    return
  }

  // 簡單的 email 驗證
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    alert('請輸入有效的 Email 地址')
    return
  }

  // 檢查是否已經邀請過
  const existingInvite = sentPendingInvites.value.find(invite => invite.viewer_email === email)
  if (existingInvite) {
    alert('已經邀請過此 Email')
    return
  }

  isInviting.value = true

  try {
    const user = await userRepository.get()
    if (!user?.id || !user?.email) {
      alert('無法取得使用者資訊')
      return
    }

    await userShareService.sendInvite(user.id, user.email, email)

    // 更新 UI
    await refreshLocalState()
    inviteEmail.value = ''
    
    alert('邀請已發送，請執行同步')
  } catch (error) {
    alert('發送邀請失敗')
    console.error('發送邀請失敗:', error)
  } finally {
    isInviting.value = false
  }
}

async function acceptInvitation(share: UserShare) {
  if (operatingShareId.value) return
  
  operatingShareId.value = share.id

  try {
    await userShareService.acceptInvitation(share)

    await refreshLocalState()
    alert('已接受邀請，請執行同步')
  } catch (error) {
    alert('接受邀請失敗')
    console.error('接受邀請失敗:', error)
  } finally {
    operatingShareId.value = null
  }
}

async function rejectOrCancelShare(share: UserShare, actionName: string) {
  if (operatingShareId.value) return
  
  if (!confirm(`確定要${actionName}嗎？`)) {
    return
  }

  operatingShareId.value = share.id

  try {
    await userShareService.rejectOrCancelShare(share)

    await refreshLocalState()
    alert(`已${actionName}，請執行同步`)
  } catch (error) {
    alert(`${actionName}失敗`)
    console.error(`${actionName}失敗:`, error)
  } finally {
    operatingShareId.value = null
  }
}</script>

<template>
  <section class="sync-page">
    <TopNavigation mode="menu-title-avatar" title="同步管理" />
    
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

      <section class="share-section">
        <h2>共享邀請</h2>
        <div class="invite-form">
          <input
            v-model="inviteEmail"
            type="email"
            placeholder="輸入要邀請的 Email"
            @keyup.enter="sendInvite"
          />
          <button
            class="btn-primary btn-invite"
            :disabled="isInviting"
            @click="sendInvite"
          >
            {{ isInviting ? '發送中...' : '發送邀請' }}
          </button>
        </div>

        <!-- 收到的邀請 (作為 viewer) -->
        <div v-if="receivedPendingInvites.length > 0" class="invites-list">
          <h3>收到的邀請 ({{ receivedPendingInvites.length }})</h3>
          <div class="invite-items">
            <div v-for="share in receivedPendingInvites" :key="share.id" class="invite-item received">
              <div class="invite-info">
                <div class="invite-email">
                  <span class="label">來自</span>
                  <span class="email-address">{{ share.owner_email }}</span>
                </div>
                <span class="status-badge pending">待接受</span>
              </div>
              <div class="invite-actions">
                <button
                  class="btn-action btn-accept"
                  :disabled="operatingShareId === share.id"
                  @click="acceptInvitation(share)"
                >
                  接受
                </button>
                <button
                  class="btn-action btn-reject"
                  :disabled="operatingShareId === share.id"
                  @click="rejectOrCancelShare(share, '拒絕邀請')"
                >
                  拒絕
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 發出的邀請 (作為 owner) -->
        <div v-if="sentPendingInvites.length > 0" class="invites-list">
          <h3>發出的邀請 ({{ sentPendingInvites.length }})</h3>
          <div class="invite-items">
            <div v-for="share in sentPendingInvites" :key="share.id" class="invite-item sent">
              <div class="invite-info">
                <div class="invite-email">
                  <span class="label">邀請</span>
                  <span class="email-address">{{ share.viewer_email }}</span>
                </div>
                <span class="status-badge pending">邀請中</span>
              </div>
              <div class="invite-actions">
                <button
                  class="btn-action btn-cancel"
                  :disabled="operatingShareId === share.id"
                  @click="rejectOrCancelShare(share, '取消邀請')"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 活躍的共享 -->
        <div v-if="activeShares.length > 0" class="invites-list">
          <h3>活躍的共享 ({{ activeShares.length }})</h3>
          <div class="invite-items">
            <div v-for="share in activeShares" :key="share.id" class="invite-item active">
              <div class="invite-info">
                <div class="invite-email">
                  <span class="label">{{ share.owner_id === userId ? '共享給' : '來自' }}</span>
                  <span class="email-address">
                    {{ share.owner_id === userId ? share.viewer_email : share.owner_email }}
                  </span>
                </div>
                <span class="status-badge active">已啟用</span>
              </div>
              <div class="invite-actions">
                <button
                  class="btn-action btn-remove"
                  :disabled="operatingShareId === share.id"
                  @click="rejectOrCancelShare(share, '刪除共享')"
                >
                  刪除
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="sentPendingInvites.length === 0 && receivedPendingInvites.length === 0 && activeShares.length === 0" class="empty-state">
          <p>暫無共享記錄</p>
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

.share-section {
  background: var(--bg-page);
  border: 2px solid var(--border-primary);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 28px;
}

.share-section h2 {
  font-size: 20px;
  margin: 0 0 16px 0;
  color: var(--text-primary);
}

.share-section h3 {
  font-size: 14px;
  margin: 0 0 12px 0;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.invite-form {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.invite-form input {
  flex: 1;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--border-primary);
  background: var(--bg-page);
  font-size: 14px;
  color: var(--text-primary);
}

.invite-form input::placeholder {
  color: var(--text-disabled);
}

.btn-invite {
  padding: 12px 24px;
  white-space: nowrap;
}

.invites-list {
  margin-top: 20px;
}

.invite-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.invite-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(71, 184, 224, 0.06);
  border: 1px solid rgba(71, 184, 224, 0.2);
  border-radius: 12px;
  padding: 12px 14px;
  gap: 12px;
}

.invite-item.received {
  background: rgba(255, 201, 82, 0.06);
  border-color: rgba(255, 201, 82, 0.2);
}

.invite-item.sent {
  background: rgba(71, 184, 224, 0.06);
  border-color: rgba(71, 184, 224, 0.2);
}

.invite-item.active {
  background: rgba(34, 197, 94, 0.06);
  border-color: rgba(34, 197, 94, 0.2);
}

.invite-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.invite-email {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.invite-email .label {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.email-address {
  font-size: 14px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-badge {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 6px;
  white-space: nowrap;
  font-weight: 500;
  flex-shrink: 0;
}

.status-badge.pending {
  color: var(--janote-income);
  background: rgba(71, 184, 224, 0.15);
}

.status-badge.active {
  color: rgb(34, 197, 94);
  background: rgba(34, 197, 94, 0.15);
}

.invite-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.btn-action {
  font-family: inherit;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
}

.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-accept {
  background: var(--janote-expense);
  color: var(--text-primary);
  box-shadow: 0 2px 6px rgba(255, 201, 82, 0.3);
}

.btn-accept:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgba(255, 201, 82, 0.4);
}

.btn-reject,
.btn-cancel,
.btn-remove {
  background: var(--janote-action);
  color: var(--text-light);
  box-shadow: 0 2px 6px rgba(248, 113, 113, 0.3);
}

.btn-reject:hover:not(:disabled),
.btn-cancel:hover:not(:disabled),
.btn-remove:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgba(248, 113, 113, 0.4);
}

.status-pending {
  font-size: 12px;
  color: var(--janote-income);
  background: rgba(71, 184, 224, 0.15);
  padding: 4px 10px;
  border-radius: 6px;
  white-space: nowrap;
}

.empty-state {
  text-align: center;
  padding: 20px;
  color: var(--text-secondary);
  font-style: italic;
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

  .invite-form {
    flex-direction: column;
  }

  .invite-form input {
    width: 100%;
  }

  .btn-invite {
    width: 100%;
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

  .share-section {
    padding: 16px;
  }

  .invite-form {
    flex-direction: column;
  }

  .invite-form input,
  .btn-invite {
    width: 100%;
  }

  .invite-item {
    padding: 10px 12px;
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .invite-info {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .invite-email {
    width: 100%;
  }

  .invite-actions {
    width: 100%;
  }

  .btn-action {
    flex: 1;
  }
}
</style>
