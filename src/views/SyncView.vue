<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { categoryRepository } from '../repositories/categoryRepository'
import { transactionRepository } from '../repositories/transactionRepository'
import { syncQueueRepository } from '../repositories/syncQueueRepository'
import { syncMetaRepository } from '../repositories/syncMetaRepository'
import { performSync } from '../services/sync.service'
import type { Category, Transaction, SyncQueueItem, LogEntry, EntryType } from '../types'

const userId = ref(localStorage.getItem('sync_user_id') || 'demo-user')
const apiBase = ref('/api')
const lastCursor = ref(0)
const categories = ref<Category[]>([])
const transactions = ref<Transaction[]>([])
const queueItems = ref<SyncQueueItem[]>([])
const syncStatus = ref<'idle' | 'syncing' | 'success' | 'error'>('idle')
const lastSyncAt = ref('')
const logEntries = ref<LogEntry[]>([])

const newCategoryName = ref('')
const newCategoryType = ref<EntryType>('EXPENSE')
const newTransaction = ref({
  category_id: '',
  type: 'EXPENSE' as EntryType,
  amount: '',
  note: '',
})

const isSyncing = computed(() => syncStatus.value === 'syncing')

const categoryMap = computed(() => {
  return categories.value.reduce((map, item) => {
    map[item.id] = item
    return map
  }, {} as Record<string, Category>)
})

const activeQueueCount = computed(() => queueItems.value.length)

watch(userId, (value) => {
  localStorage.setItem('sync_user_id', value.trim())
})

onMounted(() => {
  refreshLocalState()
})

function addLog(message: string, tone: LogEntry['tone'] = 'info', detail?: string) {
  const toneToLevel: Record<LogEntry['tone'], LogEntry['level']> = {
    info: 'INFO',
    warn: 'WARN',
    error: 'ERROR',
    success: 'SUCCESS',
  }

  logEntries.value.unshift({
    id: crypto.randomUUID(),
    time: new Date().toLocaleTimeString(),
    detail,
    level: toneToLevel[tone],
    message,
    tone,
  })

  if (logEntries.value.length > 50) {
    logEntries.value.pop()
  }
}

function formatTimestamp(value: number | undefined): string {
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString()
}

function formatEntryType(value: EntryType | undefined): string {
  if (value === 'INCOME') {
    return '收入'
  }
  return '支出'
}

async function refreshLocalState() {
  lastCursor.value = await syncMetaRepository.getLastCursor()

  const allCategories = await categoryRepository.getAll()
  const uniqueCategoriesMap = new Map<string, Category>()
  for (const cat of allCategories) {
    uniqueCategoriesMap.set(cat.id, cat)
  }
  categories.value = Array.from(uniqueCategoriesMap.values())

  const allTransactions = await transactionRepository.getAll()
  const uniqueTransactionsMap = new Map<string, Transaction>()
  for (const txn of allTransactions) {
    uniqueTransactionsMap.set(txn.id, txn)
  }
  transactions.value = Array.from(uniqueTransactionsMap.values())

  queueItems.value = await syncQueueRepository.getAllOrdered()
}

async function enqueueCategory() {
  const name = newCategoryName.value.trim()
  if (!name) {
    addLog('請輸入分類名稱', 'warn')
    return
  }

  const id = crypto.randomUUID()
  const mutationId = crypto.randomUUID()
  const payload = JSON.stringify({
    id,
    user_id: userId.value.trim(),
    name,
    type: newCategoryType.value,
  })

  await categoryRepository.upsert({ id, name, type: newCategoryType.value, version: 0, is_deleted: 0 })
  await syncQueueRepository.add({
    mutation_id: mutationId,
    entity_type: 'CAT',
    entity_id: id,
    payload,
    base_version: 0,
    created_at: Date.now(),
  })

  newCategoryName.value = ''
  newCategoryType.value = 'EXPENSE'
  addLog(`已建立本地分類: ${name}`, 'success')
  await refreshLocalState()
}

async function deleteCategory(id: string) {
  const current = categoryMap.value[id]
  if (!current) {
    return
  }

  await categoryRepository.update(id, (record) => {
    if (!record) return null
    return { ...record, is_deleted: 1 }
  })

  await syncQueueRepository.add({
    mutation_id: crypto.randomUUID(),
    entity_type: 'CAT',
    entity_id: id,
    payload: null,
    base_version: current.version || 0,
    created_at: Date.now(),
  })

  addLog(`已標記刪除分類: ${current.name}`, 'warn')
  await refreshLocalState()
}

async function enqueueTransaction() {
  const categoryId = newTransaction.value.category_id
  const amount = Number(newTransaction.value.amount)
  if (!categoryId || !Number.isFinite(amount)) {
    addLog('請選擇分類並輸入金額', 'warn')
    return
  }

  const id = crypto.randomUUID()
  const payload = JSON.stringify({
    id,
    user_id: userId.value.trim(),
    category_id: categoryId,
    type: newTransaction.value.type,
    amount,
    note: newTransaction.value.note.trim(),
    date: Date.now(),
  })

  await transactionRepository.upsert({
    id,
    category_id: categoryId,
    type: newTransaction.value.type,
    amount,
    note: newTransaction.value.note.trim(),
    date: Date.now(),
    version: 0,
    is_deleted: 0,
  })

  await syncQueueRepository.add({
    mutation_id: crypto.randomUUID(),
    entity_type: 'TXN',
    entity_id: id,
    payload,
    base_version: 0,
    created_at: Date.now(),
  })

  newTransaction.value = { category_id: '', type: 'EXPENSE', amount: '', note: '' }
  addLog('已建立本地交易', 'success')
  await refreshLocalState()
}

async function deleteTransaction(id: string) {
  const current = transactions.value.find(item => item.id === id)
  if (!current) {
    return
  }

  await transactionRepository.update(id, (record) => {
    if (!record) return null
    return { ...record, is_deleted: 1 }
  })

  await syncQueueRepository.add({
    mutation_id: crypto.randomUUID(),
    entity_type: 'TXN',
    entity_id: id,
    payload: null,
    base_version: current.version || 0,
    created_at: Date.now(),
  })

  addLog('已標記刪除交易', 'warn')
  await refreshLocalState()
}

async function syncNow() {
  const trimmedUserId = userId.value.trim()
  if (!trimmedUserId) {
    addLog('請先輸入 user_id', 'warn')
    return
  }

  syncStatus.value = 'syncing'
  addLog('開始同步...', 'info')

  try {
    const responseData = await performSync(trimmedUserId, apiBase.value)

    await refreshLocalState()

    lastSyncAt.value = new Date().toLocaleString()
    syncStatus.value = 'success'
    addLog(`同步完成 (cursor: ${responseData.new_cursor})`, 'success', `Cursor: ${responseData.new_cursor}`)
  } catch (error) {
    syncStatus.value = 'error'
    addLog((error as Error).message || '同步失敗', 'error')
  }
}
</script>

<template>
  <section class="sync-page">
    <header class="hero">
      <div class="brand">
        <p class="eyebrow">Sync Console</p>
        <h1>即時同步監控台</h1>
        <p class="subtitle">追蹤本地變更、推送狀態與伺服器回應。</p>
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
            <span>Cursor</span>
            <strong>{{ lastCursor }}</strong>
          </div>
          <div>
            <span>Queue</span>
            <strong>{{ activeQueueCount }}</strong>
          </div>
          <div>
            <span>Last Sync</span>
            <strong>{{ lastSyncAt || '-' }}</strong>
          </div>
        </div>
      </div>
    </header>

    <section class="controls">
      <div class="control">
        <label>user_id</label>
        <input v-model="userId" placeholder="demo-user" />
      </div>
      <div class="control">
        <label>API Base</label>
        <input v-model="apiBase" placeholder="/api" />
      </div>
      <div class="control actions">
        <button class="primary" :disabled="isSyncing" @click="syncNow">
          {{ isSyncing ? '同步中...' : '立即同步' }}
        </button>
        <button class="ghost" @click="refreshLocalState">重新整理</button>
      </div>
    </section>

    <section class="grid">
      <article class="panel">
        <header>
          <h2>本地分類</h2>
          <p>建立與刪除分類，會加入同步佇列。</p>
        </header>
        <div class="form">
          <input v-model="newCategoryName" placeholder="例如：餐飲" />
          <select v-model="newCategoryType">
            <option value="EXPENSE">支出</option>
            <option value="INCOME">收入</option>
          </select>
          <button class="primary" @click="enqueueCategory">新增分類</button>
        </div>
        <ul class="list">
          <li v-for="item in categories" :key="item.id" :class="{ muted: item.is_deleted }">
            <div>
              <strong>{{ item.name }}</strong>
              <span class="tag">{{ formatEntryType(item.type) }}</span>
              <span>v{{ item.version }}</span>
              <span v-if="item.is_deleted" class="tag">已刪除</span>
            </div>
            <button class="ghost" @click="deleteCategory(item.id)">刪除</button>
          </li>
        </ul>
      </article>

      <article class="panel">
        <header>
          <h2>本地交易</h2>
          <p>建立交易並送出同步。</p>
        </header>
        <div class="form two">
          <select v-model="newTransaction.category_id">
            <option value="">選擇分類</option>
            <option v-for="item in categories" :key="item.id" :value="item.id">
              {{ item.name || item.id }}
            </option>
          </select>
          <select v-model="newTransaction.type">
            <option value="EXPENSE">支出</option>
            <option value="INCOME">收入</option>
          </select>
          <input v-model="newTransaction.amount" type="number" placeholder="金額" />
          <input v-model="newTransaction.note" placeholder="備註" />
          <button class="primary" @click="enqueueTransaction">新增交易</button>
        </div>
        <ul class="list">
          <li v-for="item in transactions" :key="item.id" :class="{ muted: item.is_deleted }">
            <div>
              <strong>NT$ {{ item.amount }}</strong>
              <span>{{ categoryMap[item.category_id]?.name || '未分類' }}</span>
              <span class="tag">{{ formatEntryType(item.type) }}</span>
              <span>v{{ item.version }}</span>
              <span class="meta">{{ formatTimestamp(item.date) }}</span>
              <span v-if="item.is_deleted" class="tag">已刪除</span>
            </div>
            <button class="ghost" @click="deleteTransaction(item.id)">刪除</button>
          </li>
        </ul>
      </article>

      <article class="panel">
        <header>
          <h2>同步佇列</h2>
          <p>尚未送出的本地變更。</p>
        </header>
        <ul class="list compact">
          <li v-for="item in queueItems" :key="item.mutation_id">
            <div>
              <strong>{{ item.entity_type }}</strong>
              <span>{{ item.payload ? 'PUT' : 'DELETE' }}</span>
              <span class="meta">{{ formatTimestamp(item.created_at) }}</span>
            </div>
            <span class="mono">{{ item.entity_id.slice(0, 8) }}</span>
          </li>
          <li v-if="queueItems.length === 0" class="empty">目前沒有待同步資料</li>
        </ul>
      </article>

      <article class="panel">
        <header>
          <h2>同步紀錄</h2>
          <p>最近的同步訊息與狀態。</p>
        </header>
        <ul class="list compact">
          <li v-for="entry in logEntries" :key="entry.id" :class="entry.tone">
            <div>
              <strong>{{ entry.message }}</strong>
              <span class="meta">{{ entry.time }}</span>
              <span v-if="entry.detail" class="meta">{{ entry.detail }}</span>
            </div>
          </li>
          <li v-if="logEntries.length === 0" class="empty">尚無同步紀錄</li>
        </ul>
      </article>
    </section>
  </section>
</template>

<style scoped>
.sync-page {
  --sync-bg: #f4f0ea;
  --sync-bg-dark: #151515;
  --sync-card: #fffaf3;
  --sync-ink: #1e1b16;
  --sync-muted: #6d6257;
  --sync-accent: #ff7a3d;
  --sync-accent-2: #1aa6a8;
  --sync-shadow: rgba(24, 24, 24, 0.12);
  color-scheme: light;
  background: radial-gradient(circle at top left, #fff3e6, #f4f0ea 45%, #e9e3db 100%);
  color: var(--sync-ink);
  min-height: calc(100vh - 64px);
  padding: 36px 48px 60px;
  position: relative;
  overflow: hidden;
  border-radius: 28px;
}

.sync-page::before,
.sync-page::after {
  content: '';
  position: absolute;
  width: 520px;
  height: 520px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 122, 61, 0.3), transparent 70%);
  filter: blur(10px);
  opacity: 0.7;
  animation: float 12s ease-in-out infinite;
}

.sync-page::after {
  width: 420px;
  height: 420px;
  background: radial-gradient(circle, rgba(26, 166, 168, 0.25), transparent 70%);
  left: auto;
  right: -120px;
  top: 200px;
  animation-delay: -4s;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(-20px);
  }
  50% {
    transform: translateY(30px);
  }
}

.hero {
  display: flex;
  gap: 32px;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 28px;
  position: relative;
  z-index: 1;
}

.brand h1 {
  font-family: 'Fraunces', 'Space Grotesk', serif;
  font-size: 40px;
  margin: 4px 0 6px;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 12px;
  color: var(--sync-muted);
}

.subtitle {
  margin: 0;
  color: var(--sync-muted);
}

.status-card {
  background: var(--sync-card);
  border-radius: 18px;
  box-shadow: 0 12px 30px var(--sync-shadow);
  padding: 18px 22px;
  min-width: 280px;
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
  background: #c2b8aa;
}

.status-dot.syncing {
  background: var(--sync-accent);
  box-shadow: 0 0 12px rgba(255, 122, 61, 0.6);
}

.status-dot.success {
  background: var(--sync-accent-2);
  box-shadow: 0 0 12px rgba(26, 166, 168, 0.6);
}

.status-dot.error {
  background: #d34b45;
  box-shadow: 0 0 12px rgba(211, 75, 69, 0.6);
}

.status-text {
  font-weight: 600;
}

.status-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.status-meta span {
  font-size: 12px;
  color: var(--sync-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.status-meta strong {
  display: block;
  font-size: 14px;
}

.controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 16px;
  padding: 16px;
  backdrop-filter: blur(6px);
  margin-bottom: 28px;
  position: relative;
  z-index: 1;
}

.control label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--sync-muted);
  margin-bottom: 6px;
  display: block;
}

.sync-page input,
.sync-page select {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #e3d8ca;
  background: white;
  font-size: 14px;
}

.actions {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}

.sync-page button {
  font-family: inherit;
  border: none;
  border-radius: 12px;
  padding: 10px 16px;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.sync-page button.primary {
  background: var(--sync-bg-dark);
  color: white;
  box-shadow: 0 12px 24px rgba(21, 21, 21, 0.2);
}

.sync-page button.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}

.sync-page button.ghost {
  background: transparent;
  border: 1px solid #d4c7b6;
}

.sync-page button:hover:not(:disabled) {
  transform: translateY(-1px);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 20px;
  position: relative;
  z-index: 1;
}

.panel {
  background: var(--sync-card);
  border-radius: 20px;
  padding: 18px;
  box-shadow: 0 16px 30px var(--sync-shadow);
  animation: rise 0.6s ease both;
}

@keyframes rise {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.panel header h2 {
  margin: 0 0 6px;
}

.panel header p {
  margin: 0 0 16px;
  color: var(--sync-muted);
  font-size: 13px;
}

.form {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.form.two {
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid #efe3d6;
}

.list li.muted {
  opacity: 0.6;
}

.list li div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
}

.list .tag {
  background: #f1d4c8;
  color: #9b3a1e;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
}

.list .meta {
  color: var(--sync-muted);
  font-size: 12px;
}

.list.compact li {
  font-size: 13px;
}

.list .mono {
  font-family: 'Space Grotesk', monospace;
  color: var(--sync-muted);
}

.list li.empty {
  background: transparent;
  border: 1px dashed #d9cbbb;
  color: var(--sync-muted);
  justify-content: center;
}

.list li.success {
  border-color: rgba(26, 166, 168, 0.5);
}

.list li.error {
  border-color: rgba(211, 75, 69, 0.5);
}

.list li.warn {
  border-color: rgba(255, 122, 61, 0.5);
}

@media (max-width: 900px) {
  .sync-page {
    padding: 28px 22px 40px;
    border-radius: 22px;
  }

  .hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .status-card {
    width: 100%;
  }
}
</style>
