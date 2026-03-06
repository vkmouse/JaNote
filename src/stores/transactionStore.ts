import { ref } from "vue";
import { defineStore } from "pinia";
import { transactionRepository } from "../db/repositories/transactionRepository";
import { categoryRepository } from "../db/repositories/categoryRepository";
import { syncQueueRepository } from "../db/repositories/syncQueueRepository";
import { userRepository } from "../db/repositories/userRepository";
import type { Transaction, Category } from "../types";

export const useTransactionStore = defineStore("transaction", () => {
  // ── State ──────────────────────────────────────────────────
  const transactions = ref<Transaction[]>([]);
  const categories = ref<Category[]>([]);

  // ── Actions ────────────────────────────────────────────────
  async function loadTransactions(): Promise<void> {
    transactions.value = await transactionRepository.getAll();
  }

  async function loadCategories(): Promise<void> {
    categories.value = await categoryRepository.getAll();
  }

  async function getTransactionById(
    id: string,
  ): Promise<Transaction | undefined> {
    return transactionRepository.getById(id);
  }

  /** 新增交易並加入同步佇列 */
  async function addTransaction({
    category_id,
    type,
    amount,
    note,
    date,
  }: {
    category_id: string;
    type: "EXPENSE" | "INCOME";
    amount: number;
    note: string;
    date: number;
  }): Promise<void> {
    const user = await userRepository.get();
    const user_id = user?.id || "";
    const id = crypto.randomUUID();

    const transaction: Transaction = {
      id,
      user_id,
      category_id,
      type,
      amount,
      note,
      date,
      version: 1,
      is_deleted: 0,
    };

    await transactionRepository.upsert(transaction);

    try {
      await syncQueueRepository.add({
        mutation_id: crypto.randomUUID(),
        entity_type: "TXN",
        entity_id: id,
        action: "POST",
        payload: JSON.stringify({
          id,
          user_id,
          category_id,
          type,
          amount,
          note,
          date,
        }),
        base_version: 0,
        snapshot_before: null,
        created_at: Date.now(),
      });
    } catch (e) {
      console.error("Failed to enqueue sync operation", e);
    }

    await loadTransactions();
  }

  /** 更新交易並加入同步佇列 */
  async function updateTransaction({
    id,
    category_id,
    type,
    amount,
    note,
    date,
  }: {
    id: string;
    category_id: string;
    type: "EXPENSE" | "INCOME";
    amount: number;
    note: string;
    date: number;
  }): Promise<void> {
    const user = await userRepository.get();
    const user_id = user?.id || "";

    const existingTransaction = await transactionRepository.getById(id);
    if (!existingTransaction) {
      throw new Error("Transaction not found");
    }

    const snapshot = JSON.stringify(existingTransaction);

    const updatedTransaction: Transaction = {
      ...existingTransaction,
      user_id,
      category_id,
      type,
      amount,
      note,
      date,
      version: existingTransaction.version + 1,
    };

    await transactionRepository.upsert(updatedTransaction);

    try {
      await syncQueueRepository.add({
        mutation_id: crypto.randomUUID(),
        entity_type: "TXN",
        entity_id: id,
        action: "PUT",
        payload: JSON.stringify({
          id,
          user_id,
          category_id,
          type,
          amount,
          note,
          date,
        }),
        base_version: existingTransaction.version,
        snapshot_before: snapshot,
        created_at: Date.now(),
      });
    } catch (e) {
      console.error("Failed to enqueue sync operation", e);
    }

    await loadTransactions();
  }

  /** 軟刪除交易並加入同步佇列 */
  async function deleteTransaction(id: string): Promise<void> {
    const transaction = await transactionRepository.getById(id);
    if (!transaction) {
      throw new Error("Transaction not found");
    }

    const snapshot = JSON.stringify(transaction);

    await transactionRepository.update(id, (current) => {
      if (!current) return null;
      return { ...current, is_deleted: 1, version: current.version + 1 };
    });

    await syncQueueRepository.add({
      mutation_id: crypto.randomUUID(),
      entity_type: "TXN",
      entity_id: id,
      action: "DELETE",
      payload: null,
      base_version: transaction.version,
      snapshot_before: snapshot,
      created_at: Date.now(),
    });

    await loadTransactions();
  }

  /** 清空所有交易（用於本機重置） */
  async function deleteAllTransactions(): Promise<void> {
    await transactionRepository.deleteAll();
    transactions.value = [];
  }

  /** 清空所有分類（用於本機重置） */
  async function deleteAllCategories(): Promise<void> {
    await categoryRepository.deleteAll();
    categories.value = [];
  }

  return {
    // state
    transactions,
    categories,
    // actions
    loadTransactions,
    loadCategories,
    getTransactionById,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    deleteAllTransactions,
    deleteAllCategories,
  };
});
