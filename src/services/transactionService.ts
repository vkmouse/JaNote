import { transactionRepository } from '../repositories/transactionRepository'
import { syncQueueRepository } from '../repositories/syncQueueRepository'
import type { Transaction } from '../types'

/**
 * 保存或更新交易（用於編輯頁面）
 */
async function upsertTransaction(transaction: Transaction, isEditing: boolean = false): Promise<void> {
  const baseVersion = isEditing ? transaction.version - 1 : 0

  await transactionRepository.upsert(transaction)

  try {
    const mutationId = crypto.randomUUID()
    const payload = JSON.stringify({
      id: transaction.id,
      category_id: transaction.category_id,
      type: transaction.type,
      amount: transaction.amount,
      note: transaction.note,
      date: transaction.date,
    })

    await syncQueueRepository.add({
      mutation_id: mutationId,
      entity_type: 'TXN',
      entity_id: transaction.id,
      action: 'PUT',
      payload,
      base_version: baseVersion,
      created_at: Date.now(),
    })
  } catch (e) {
    console.error('Failed to enqueue sync operation', e)
    // Don't throw - allow the transaction to be saved locally
  }
}

/**
 * 刪除交易（軟刪除）
 */
async function deleteTransaction(id: string, currentVersion: number): Promise<void> {
  await transactionRepository.update(id, (current) => {
    if (!current) return null
    return { ...current, is_deleted: 1, version: current.version + 1 }
  })

  await syncQueueRepository.add({
    mutation_id: crypto.randomUUID(),
    entity_type: 'TXN',
    entity_id: id,
    action: 'DELETE',
    payload: null,
    base_version: currentVersion,
    created_at: Date.now(),
  })
}

/**
 * 刪除所有交易（用於清空本地資料）
 */
async function deleteAllTransactions(): Promise<void> {
  await transactionRepository.deleteAll()
}

export const transactionService = {
  upsertTransaction,
  deleteTransaction,
  deleteAllTransactions,
}
