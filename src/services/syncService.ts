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

async function applyPullEvent(event: PullEvent): Promise<void> {
  const payload = parsePayload(event.payload)

  if (event.entity_type === 'CAT') {
    if (event.action === 'DELETE') {
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

async function rollbackEntity(entry: SyncQueueItem): Promise<void> {
  if (!entry.snapshot_before) {
    // 沒有快照，無法 rollback（可能是 POST 操作）
    if (entry.action === 'POST') {
      // POST 失敗，刪除本地創建的 entity
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
    console.error('Failed to rollback entity', entry.entity_id, error)
  }
}

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

  // 如果最後的操作成功了，以最後結果為準，不需要 rollback
  if (lastResult?.status === 'OK' || lastResult?.status === 'SKIPPED') {
    await syncQueueRepository.removeByEntityId(entry.entity_id)
    return
  }

  // 如果有 pull_event，以 pull_event 為準
  if (pullEntityIds.has(entry.entity_id)) {
    await syncQueueRepository.removeByEntityId(entry.entity_id)
    return
  }

  // 真正需要 rollback：回到 snapshot_before 的狀態
  await rollbackEntity(entry)
  await syncQueueRepository.removeByEntityId(entry.entity_id)

  // TODO: 通知使用者（視 error_code 決定是否顯示）
  console.warn('Operation failed and rolled back:', {
    entity_id: entry.entity_id,
    entity_type: entry.entity_type,
    action: entry.action,
    error_code: errorResult.error_code,
    error_message: errorResult.error_message,
  })
}

export async function performSync(apiBase: string): Promise<SyncResponse> {
  const lastCursor = await syncMetaRepository.getLastCursor()
  const queue = await syncQueueRepository.getAllOrdered()
  const localUser = await userRepository.get()

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

  const mutationMap = new Map<string, SyncQueueItem>(queue.map(item => [item.mutation_id, item]))

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
  const pullEntityIds = new Set(pullEvents.map(event => event.entity_id))

  // 1. 先 apply pull_events（server 事實優先）
  for (const event of pullEvents) {
    await applyPullEvent(event)
  }

  // 2. 處理每個 push_result
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

  // 3. 清除所有涉及 pull_events 的 entity 的 queue
  for (const entityId of pullEntityIds) {
    await syncQueueRepository.removeByEntityId(entityId)
  }

  await syncMetaRepository.setLastCursor(responseData.new_cursor || lastCursor)
  
  // Save user info from response
  if (responseData.user) {
    await userRepository.set(responseData.user)
  }

  return responseData
}

export const syncService = {
  performSync
}
