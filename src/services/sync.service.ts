import { syncQueueRepository } from '../repositories/syncQueueRepository'
import { syncMetaRepository } from '../repositories/syncMetaRepository'
import { categoryRepository } from '../repositories/categoryRepository'
import { transactionRepository } from '../repositories/transactionRepository'
import type {
  SyncQueueItem,
  PushEvent,
  PullEvent,
  SyncResponse,
  CategoryPayload,
  TransactionPayload,
} from '../types'

function parsePayload(payload: string | null): CategoryPayload | TransactionPayload | null {
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
}

async function bumpLocalVersion(
  entityType: 'CAT' | 'TXN',
  entityId: string,
  version: number,
  action: 'PUT' | 'DELETE'
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

  await transactionRepository.update(entityId, (record) => {
    if (!record) return null
    return {
      ...record,
      version,
      is_deleted: action === 'DELETE' ? 1 : record.is_deleted,
    }
  })
}

export async function performSync(userId: string, apiBase: string): Promise<SyncResponse> {
  const lastCursor = await syncMetaRepository.getLastCursor()
  const queue = await syncQueueRepository.getAllOrdered()

  const pushEvents: PushEvent[] = queue.map(item => ({
    mutation_id: item.mutation_id,
    entity_type: item.entity_type,
    entity_id: item.entity_id,
    action: item.payload ? 'PUT' : 'DELETE',
    base_version: item.base_version,
    payload: parsePayload(item.payload),
  }))

  const mutationMap = new Map<string, SyncQueueItem>(queue.map(item => [item.mutation_id, item]))

  let responseData: SyncResponse
  const response = await fetch(`${apiBase}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      last_cursor: lastCursor,
      push_events: pushEvents,
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
    await bumpLocalVersion(
      entry.entity_type,
      entry.entity_id,
      newVersion,
      entry.payload ? 'PUT' : 'DELETE'
    )
  }

  await syncMetaRepository.setLastCursor(responseData.new_cursor || lastCursor)

  return responseData
}
