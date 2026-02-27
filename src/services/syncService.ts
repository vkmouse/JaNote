import { syncQueueRepository } from '../repositories/syncQueueRepository'
import { syncMetaRepository } from '../repositories/syncMetaRepository'
import { categoryRepository } from '../repositories/categoryRepository'
import { transactionRepository } from '../repositories/transactionRepository'
import { userShareRepository } from '../repositories/userShareRepository'
import { userRepository } from '../repositories/userRepository'
import type {
  SyncQueueItem,
  PushCommand,
  PushResult,
  PullEvent,
  SyncResponse,
  CategoryPayload,
  TransactionPayload,
  UserSharePayload,
} from '../types'

/**
 * 輔助函式：將 JSON 字串解析為對應的 Payload 物件
 * 如果已經是物件則直接回傳，解析失敗則回傳 null
 */
function parsePayload(payload: string | null): CategoryPayload | TransactionPayload | UserSharePayload | null {
  if (!payload) {
    return null
  }
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload)
    } catch {
      return null
    }
  }
  return payload
}

/**
 * 處理來自伺服器的新資料 (Pull Event)
 * 原則：伺服器的狀態永遠是「真理 (Server Truth)」，當伺服器傳來資料時，本地端必須無條件覆蓋。
 */
async function applyPullEvent(event: PullEvent): Promise<void> {
  const payload = parsePayload(event.payload)

  // 處理「分類 (Category)」的變更
  if (event.entity_type === 'CAT') {
    if (event.action === 'DELETE') {
      // 伺服器說要刪除，我們在本地端執行「軟刪除 (Soft Delete)」，將 is_deleted 設為 1
      await categoryRepository.update(event.entity_id, (record) => {
        if (!record) {
          return {
            id: event.entity_id,
            user_id: '',
            name: 'Unknown',
            type: 'EXPENSE',
            version: event.version,
            is_deleted: 1,
          }
        }
        return { ...record, version: event.version, is_deleted: 1 }
      })
      return
    }

    if (!payload || typeof payload !== 'object') {
      return
    }

    const catPayload = payload as CategoryPayload
    // 伺服器傳來新增或修改，我們在本地端執行 Upsert (存在則更新，不存在則新增)
    await categoryRepository.upsert({
      id: event.entity_id,
      user_id: catPayload.user_id || '',
      name: catPayload.name || 'Untitled',
      type: catPayload.type || 'EXPENSE',
      version: event.version,
      is_deleted: 0,
    })
    return
  }

  // 處理「交易 (Transaction)」的變更
  if (event.entity_type === 'TXN') {
    if (event.action === 'DELETE') {
      await transactionRepository.update(event.entity_id, (record) => {
        if (!record) {
          return {
            id: event.entity_id,
            user_id: '',
            category_id: '',
            type: 'EXPENSE',
            amount: 0,
            note: '',
            date: Date.now(),
            version: event.version,
            is_deleted: 1,
          }
        }
        return { ...record, version: event.version, is_deleted: 1 }
      })
      return
    }

    if (!payload || typeof payload !== 'object') {
      return
    }

    const txnPayload = payload as TransactionPayload
    await transactionRepository.upsert({
      id: event.entity_id,
      user_id: txnPayload.user_id || '',
      category_id: txnPayload.category_id || '',
      type: txnPayload.type || 'EXPENSE',
      amount: Number(txnPayload.amount) || 0,
      note: txnPayload.note || '',
      date: txnPayload.date || Date.now(),
      version: event.version,
      is_deleted: 0,
    })
    return
  }

  // 處理「共用設定 (User Share)」的變更
  if (event.entity_type === 'SHR') {
    if (event.action === 'DELETE') {
      await userShareRepository.update(event.entity_id, (record) => {
        if (!record) {
          return null
        }
        return { ...record, version: event.version, is_deleted: 1 }
      })
      return
    }

    if (!payload || typeof payload !== 'object') {
      return
    }

    const shrPayload = payload as UserSharePayload
    await userShareRepository.upsert({
      id: event.entity_id,
      owner_id: shrPayload.owner_id || '',
      owner_email: shrPayload.owner_email || '',
      viewer_id: shrPayload.viewer_id || '',
      viewer_email: shrPayload.viewer_email || '',
      status: shrPayload.status || 'PENDING',
      version: event.version,
      is_deleted: 0,
    })
    return
  }
}

/**
 * 提升本地版本號 (Bump Local Version)
 * 當我們成功推播 (Push) 資料到伺服器後，伺服器會賦予該資料一個新的版本號。
 * 我們必須更新本地資料庫裡的版本號，才能跟伺服器保持同步。
 */
async function bumpLocalVersion(
  entityType: 'CAT' | 'TXN' | 'SHR',
  entityId: string,
  version: number,
  action: 'PUT' | 'DELETE' | 'POST'
): Promise<void> {
  if (entityType === 'CAT') {
    await categoryRepository.update(entityId, (record) => {
      if (!record) return null
      return {
        ...record,
        version,
        // 如果剛剛成功推播的是「刪除」動作，確保本地狀態也是已刪除
        is_deleted: action === 'DELETE' ? 1 : record.is_deleted,
      }
    })
    return
  }

  if (entityType === 'TXN') {
    await transactionRepository.update(entityId, (record) => {
      if (!record) return null
      return {
        ...record,
        version,
        is_deleted: action === 'DELETE' ? 1 : record.is_deleted,
      }
    })
    return
  }

  if (entityType === 'SHR') {
    await userShareRepository.update(entityId, (record) => {
      if (!record) return null
      return {
        ...record,
        version,
        is_deleted: action === 'DELETE' ? 1 : record.is_deleted,
      }
    })
    return
  }
}

/**
 * 發生錯誤時的資料還原 (Rollback)
 * 如果我們推播到伺服器的動作失敗了（例如被伺服器拒絕），我們必須把本地資料還原成修改前的狀態。
 */
async function rollbackEntity(entry: SyncQueueItem): Promise<void> {
  if (!entry.snapshot_before) {
    // 如果沒有修改前的快照 (snapshot_before)，代表這是一筆全新的資料（POST 操作）
    if (entry.action === 'POST') {
      // POST (新增) 失敗了，把這筆本地創建的資料標記為「已刪除」
      if (entry.entity_type === 'TXN') {
        await transactionRepository.update(entry.entity_id, (record) => {
          if (!record) return null
          return { ...record, is_deleted: 1 }
        })
      } else if (entry.entity_type === 'SHR') {
        await userShareRepository.update(entry.entity_id, (record) => {
          if (!record) return null
          return { ...record, is_deleted: 1 }
        })
      }
    }
    return
  }

  // 如果有快照，就解析快照並強行覆蓋回本地資料庫（回到修改前的狀態）
  try {
    const snapshot = JSON.parse(entry.snapshot_before)

    if (entry.entity_type === 'CAT') {
      await categoryRepository.upsert(snapshot)
    } else if (entry.entity_type === 'TXN') {
      await transactionRepository.upsert(snapshot)
    } else if (entry.entity_type === 'SHR') {
      await userShareRepository.upsert(snapshot)
    }
  } catch (error) {
    console.error('還原實體失敗 (Failed to rollback entity)', entry.entity_id, error)
  }
}

/**
 * 處理推播失敗的情況
 */
async function handleError(
  errorResult: PushResult,
  entry: SyncQueueItem,
  mutationMap: Map<string, SyncQueueItem>,
  allResults: PushResult[],
  pullEntityIds: Set<string>
): Promise<void> {
  // 找出這個 entity 後續的操作結果
  const laterResults = allResults.filter(r => {
    const e = mutationMap.get(r.mutation_id)
    return e?.entity_id === entry.entity_id && e.created_at > entry.created_at
  })

  const lastResult = laterResults.length > 0 ? laterResults[laterResults.length - 1] : undefined

  // 如果最後的操作成功 (OK) 或被跳過 (SKIPPED)，以最後結果為準，不需要還原 (rollback)
  if (lastResult?.status === 'OK' || lastResult?.status === 'SKIPPED') {
    await syncQueueRepository.removeByEntityId(entry.entity_id)
    return
  }

  // 如果伺服器剛好傳來了這筆資料的最新狀態 (pull_event)
  if (pullEntityIds.has(entry.entity_id)) {
    await syncQueueRepository.removeByEntityId(entry.entity_id)
    return
  }

  // 真正需要還原 (Rollback)：回到 snapshot_before 的狀態
  await rollbackEntity(entry)
  await syncQueueRepository.removeByEntityId(entry.entity_id)

  // 寫入錯誤 error_code 和 error_message 到 log
  console.warn('Operation failed and rolled back:', {
    entity_id: entry.entity_id,
    entity_type: entry.entity_type,
    action: entry.action,
    error_code: errorResult.error_code,
    error_message: errorResult.error_message,
  })
}

/**
 * 執行同步的主要入口點 (Main Orchestrator)
 */
export async function performSync(apiBase: string): Promise<SyncResponse> {
  // 取得上一次同步的游標
  const lastCursor = await syncMetaRepository.getLastCursor()
  // 取得所有的等待推播
  const queue = await syncQueueRepository.getAllOrdered()
  // 取得當前本地登入的使用者資訊
  const localUser = await userRepository.get()

  // 將本地佇列轉換成 API 接受的格式
  const pushCommands: PushCommand[] = queue.map(item => {
    return {
      mutation_id: item.mutation_id,
      entity_type: item.entity_type,
      entity_id: item.entity_id,
      action: item.action,
      base_version: item.base_version,
      payload: parsePayload(item.payload),
    }
  })

  // 建立一個 Map 方便後續用 mutation_id 快速查找原始的佇列項目
  const mutationMap = new Map<string, SyncQueueItem>(queue.map(item => [item.mutation_id, item]))

  // ==========================================
  // 發送同步請求給伺服器 (包含 Push 與 Pull)
  // ==========================================
  let responseData: SyncResponse
  const response = await fetch(`${apiBase}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      last_cursor: lastCursor,
      push_commands: pushCommands,
      user: localUser,
    }),
  })

  if (!response.ok) {
    throw new Error(`Sync failed with status ${response.status}`)
  }

  responseData = await response.json()

  const pushResultsList: PushResult[] = responseData.push_results || []
  const pullEvents = responseData.pull_events || []

  // 記錄哪些資料 (entity_id) 在這次同步中從伺服器拉到了新版本
  const pullEntityIds = new Set(pullEvents.map(event => event.entity_id))

  // ==========================================
  // 步驟 1：先套用伺服器傳來的新資料 (Pull Events)
  // 重要：本地架構中，Server 的事實永遠優先，所以先套用 Pull
  // ==========================================
  for (const event of pullEvents) {
    await applyPullEvent(event)
  }

  // ==========================================
  // 步驟 2：處理我們剛剛推播給伺服器的結果 (Push Results)
  // ==========================================
  for (const result of pushResultsList) {
    const entry = mutationMap.get(result.mutation_id)
    if (!entry) continue

    if (result.status === 'OK') {
      if (result.version == null) continue
      
      // 如果有 pull_event，已經 apply 過了，不需要 bump
      if (!pullEntityIds.has(entry.entity_id)) {
        const action: 'PUT' | 'DELETE' | 'POST' = entry.action as 'PUT' | 'DELETE' | 'POST'
        await bumpLocalVersion(
          entry.entity_type,
          entry.entity_id,
          result.version,
          action
        )
      }
      await syncQueueRepository.removeByMutationIds([result.mutation_id])
    } else if (result.status === 'SKIPPED') {
      // SKIPPED：目標已達成，清除 queue 即可
      await syncQueueRepository.removeByMutationIds([result.mutation_id])
    } else if (result.status === 'ERROR') {
      // ERROR：需要根據情況決定是否 rollback
      await handleError(result, entry, mutationMap, pushResultsList, pullEntityIds)
    }
  }

  // ==========================================
  // 步驟 3：清理與更新狀態
  // ==========================================

  // 如果某些資料被伺服器的新狀態 (Pull) 覆蓋了，
  // 這些資料還卡在本地佇列裡準備推播的舊動作就必須捨棄作廢，以避免下次又推播舊資料覆蓋伺服器。
  for (const entityId of pullEntityIds) {
    await syncQueueRepository.removeByEntityId(entityId)
  }

  // 更新本地的同步游標
  await syncMetaRepository.setLastCursor(responseData.new_cursor || lastCursor)
  
  // 更新本地的的使用者資訊
  if (responseData.user) {
    await userRepository.set(responseData.user)
  }

  return responseData
}

export const syncService = {
  performSync
}
