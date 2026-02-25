import { syncQueueRepository } from '../repositories/syncQueueRepository'
import { syncMetaRepository } from '../repositories/syncMetaRepository'
import { categoryRepository } from '../repositories/categoryRepository'
import { transactionRepository } from '../repositories/transactionRepository'
import { userShareRepository } from '../repositories/userShareRepository'
import { userRepository } from '../repositories/userRepository'
import type {
  SyncQueueItem,
  PushEvent,
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

export async function performSync(apiBase: string): Promise<SyncResponse> {
  const lastCursor = await syncMetaRepository.getLastCursor()
  const queue = await syncQueueRepository.getAllOrdered()
  const localUser = await userRepository.get()

  const pushEvents: PushEvent[] = queue.map(item => {
    let action: 'PUT' | 'DELETE' | 'POST' = item.payload ? 'PUT' : 'DELETE'
    
    // SHR 類型的 sync_queue 中，如果有 payload 則是 POST action
    if (item.entity_type === 'SHR' && item.payload) {
      action = 'POST'
    }
    
    return {
      mutation_id: item.mutation_id,
      entity_type: item.entity_type,
      entity_id: item.entity_id,
      action,
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
      push_events: pushEvents,
      user: localUser,
    }),
  })

  if (!response.ok) {
    throw new Error(`Sync failed with status ${response.status}`)
  }

  responseData = await response.json()

  const processedIds = responseData.processed_mutation_ids || []
  const pullEvents = responseData.pull_events || []
  const pullEntityIds = new Set(pullEvents.map(event => event.entity_id))

  await syncQueueRepository.removeByMutationIds(processedIds)

  for (const event of pullEvents) {
    const queuedForEntity = await syncQueueRepository.getByEntityId(event.entity_id)

    if (queuedForEntity.length) {
      await applyPullEvent(event)
      await syncQueueRepository.removeByEntityId(event.entity_id)
    } else {
      await applyPullEvent(event)
    }
  }

  for (const mutationId of processedIds) {
    const entry = mutationMap.get(mutationId)
    if (!entry) continue
    if (pullEntityIds.has(entry.entity_id)) continue

    const newVersion = (entry.base_version || 0) + 1
    let action: 'PUT' | 'DELETE' | 'POST' = entry.payload ? 'PUT' : 'DELETE'
    
    // SHR 類型的 sync_queue 中，如果有 payload 則是 POST action
    if (entry.entity_type === 'SHR' && entry.payload) {
      action = 'POST'
    }
    
    await bumpLocalVersion(
      entry.entity_type,
      entry.entity_id,
      newVersion,
      action
    )
  }

  await syncMetaRepository.setLastCursor(responseData.new_cursor || lastCursor)
  
  // Save user info from response
  if (responseData.user) {
    await userRepository.set(responseData.user)
  }

  return responseData
}
