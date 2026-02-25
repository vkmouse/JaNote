import { transactionRepository } from '../repositories/transactionRepository'
import { syncQueueRepository } from '../repositories/syncQueueRepository'
import type { Transaction } from '../types'

/**
 * 新增交易
 */
async function addTransaction({ category_id, type, amount, note, date }: {
  category_id: string
  type: 'EXPENSE' | 'INCOME'
  amount: number
  note: string
  date: number
}): Promise<void> {
  const id = crypto.randomUUID()
  const transaction: Transaction = {
    id,
    category_id,
    type,
    amount,
    note,
    date,
    version: 1,
    is_deleted: 0
  }

  await transactionRepository.upsert(transaction)

  try {
    const mutationId = crypto.randomUUID()
    const payload = JSON.stringify({
      id,
      category_id,
      type,
      amount,
      note,
      date,
    })

    await syncQueueRepository.add({
      mutation_id: mutationId,
      entity_type: 'TXN',
      entity_id: id,
      action: 'PUT',
      payload,
      base_version: 0,
      created_at: Date.now(),
    })
  } catch (e) {
    console.error('Failed to enqueue sync operation', e)
    // Don't throw - allow the transaction to be saved locally
  }
}

/**
 * 更新交易
 */
async function updateTransaction({ id, category_id, type, amount, note, date }: {
  id: string
  category_id: string
  type: 'EXPENSE' | 'INCOME'
  amount: number
  note: string
  date: number
}): Promise<void> {
  const existingTransaction = await transactionRepository.getById(id)
  if (!existingTransaction) {
    throw new Error('Transaction not found')
  }

  const updatedTransaction: Transaction = {
    ...existingTransaction,
    category_id,
    type,
    amount,
    note,
    date,
    version: existingTransaction.version + 1
  }

  await transactionRepository.upsert(updatedTransaction)

  try {
    const mutationId = crypto.randomUUID()
    const payload = JSON.stringify({
      id,
      category_id,
      type,
      amount,
      note,
      date,
    })

    await syncQueueRepository.add({
      mutation_id: mutationId,
      entity_type: 'TXN',
      entity_id: id,
      action: 'PUT',
      payload,
      base_version: existingTransaction.version,
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
async function deleteTransaction(id: string): Promise<void> {
  const transaction = await transactionRepository.getById(id)
  if (!transaction) {
    throw new Error('Transaction not found')
  }

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
    base_version: transaction.version,
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
  addTransaction,
  updateTransaction,
  deleteTransaction,
  deleteAllTransactions,
}
