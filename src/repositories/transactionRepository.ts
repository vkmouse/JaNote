import { withStore, getAll, openDb } from '../utils/database'
import type { Transaction } from '../types'

const storeName = 'transactions' as const

async function getAllTransactions(): Promise<Transaction[]> {
  return getAll<Transaction>(storeName)
}

async function getTransactionById(id: string): Promise<Transaction | undefined> {
  const transactions = await getAllTransactions()
  return transactions.find(txn => txn.id === id)
}

async function getByCategoryId(categoryId: string): Promise<Transaction[]> {
  const transactions = await getAllTransactions()
  return transactions.filter(txn => txn.category_id === categoryId)
}

async function upsert(transaction: Transaction): Promise<void> {
  await withStore(storeName, 'readwrite', store => store.put(transaction))
}

async function upsertMany(transactions: Transaction[]): Promise<void> {
  await withStore(storeName, 'readwrite', store => {
    transactions.forEach(transaction => store.put(transaction))
  })
}

async function update(
  id: string,
  updater: (current: Transaction | undefined) => Transaction | null
): Promise<void> {
  return withStore(storeName, 'readwrite', (store) => {
    const request = store.get(id)
    request.onsuccess = () => {
      const current = request.result as Transaction | undefined
      const updated = updater(current)
      if (updated) {
        store.put(updated)
      }
    }
  })
}

async function deleteTransaction(id: string): Promise<void> {
  await withStore(storeName, 'readwrite', store => store.delete(id))
}

async function deleteAllTransactions(): Promise<void> {
  await withStore(storeName, 'readwrite', store => store.clear())
}

async function deleteByCategoryId(categoryId: string): Promise<void> {
  const transactions = await getByCategoryId(categoryId)
  await withStore(storeName, 'readwrite', store => {
    transactions.forEach(txn => store.delete(txn.id))
  })
}

async function count(): Promise<number> {
  const db = await openDb()
  const tx = db.transaction(storeName, 'readonly')
  const request = tx.objectStore(storeName).count()
  return new Promise<number>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function getByDateRange(startDate: number, endDate: number): Promise<Transaction[]> {
  const transactions = await getAllTransactions()
  return transactions.filter(txn => txn.date >= startDate && txn.date <= endDate)
}

export const transactionRepository = {
  getAll: getAllTransactions,
  getById: getTransactionById,
  getByCategoryId,
  upsert,
  upsertMany,
  update,
  delete: deleteTransaction,
  deleteAll: deleteAllTransactions,
  deleteByCategoryId,
  count,
  getByDateRange,
}
