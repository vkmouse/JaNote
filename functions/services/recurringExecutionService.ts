import type { RecurringTransaction, RecurringBudget } from "../types";
import {
  getActiveRecurringTransactionsByUserId,
  updateLastExecutedAt as updateRtxnLastExecutedAt,
} from "../repositories/recurringTransactionRepository";
import {
  getActiveRecurringBudgetsByUserId,
  updateRecurringBudgetLastExecutedAt,
} from "../repositories/recurringBudgetRepository";
import { createTransaction } from "../repositories/transactionRepository";
import { createBudget } from "../repositories/budgetRepository";
import { insertSyncEvent } from "../repositories/syncEventRepository";

/**
 * 取得今天的日期字串 (YYYY-MM-DD)，用於比對 last_executed_at
 */
function getTodayDateString(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 取得當月的 month_key (YYYYMM)，用於建立預算
 */
function getCurrentMonthKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}${month}`;
}

/**
 * 取得 last_executed_at 的月份 (YYYYMM)，用於比對是否為當月
 */
function getMonthKeyFromDate(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}${month}`;
}

/**
 * 取得今天的 UTC 午夜時間戳 (毫秒)，作為自動建立交易的日期
 */
function getTodayTimestamp(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/**
 * 判斷今天是否符合固定交易的執行條件
 *
 * recurrence_day 為單一整數：
 * - MONTHLY: 5 表示每月 5 號
 * - WEEKLY: 0 表示每週一 (0=一, 1=二, ..., 6=日)
 */
function shouldExecuteToday(rtxn: RecurringTransaction): boolean {
  const day = rtxn.recurrence_day;
  if (day === null || day === undefined) return false;

  const now = new Date();

  if (rtxn.recurrence_type === "MONTHLY") {
    return now.getUTCDate() === day;
  }

  if (rtxn.recurrence_type === "WEEKLY") {
    // JavaScript getUTCDay(): 0=Sunday, 1=Monday, ..., 6=Saturday
    // 前端定義: 0=一(Mon), 1=二(Tue), ..., 6=日(Sun)
    // 轉換: frontendDay = (jsDay + 6) % 7
    const jsDay = now.getUTCDay();
    const frontendDay = (jsDay + 6) % 7;
    return frontendDay === day;
  }

  return false;
}

/**
 * 產生 UUID (適用於 Cloudflare Workers)
 */
function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * 在同步時自動執行固定排程
 * - 檢查所有 active 的固定交易和固定預算
 * - 判斷是否符合今天的執行條件
 * - 符合條件則自動建立對應的交易或預算
 * - 更新 last_executed_at
 */
export async function executeRecurringSchedules(
  userId: string,
  DB: D1Database,
): Promise<void> {
  const todayStr = getTodayDateString();
  const todayTimestamp = getTodayTimestamp();
  const currentMonthKey = getCurrentMonthKey();

  // ── 處理固定交易 ──────────────────────────────────────────
  const activeTransactions = await getActiveRecurringTransactionsByUserId(userId, DB);

  for (const rtxn of activeTransactions) {
    // 今天已執行過則跳過
    if (rtxn.last_executed_at === todayStr) continue;

    // 判斷今天是否符合排程條件
    if (!shouldExecuteToday(rtxn)) continue;

    // 自動建立交易
    const txnId = generateUUID();
    const mutationId = generateUUID();
    const txnVersion = 1;

    await createTransaction(
      txnId,
      userId,
      rtxn.category_id,
      rtxn.type,
      rtxn.amount,
      rtxn.note,
      todayTimestamp,
      txnVersion,
      DB,
    );

    // 建立 sync event，讓前端 Pull 時收到新交易
    const syncPayload = JSON.stringify({
      action: "POST",
      version: txnVersion,
      payload: JSON.stringify({
        id: txnId,
        user_id: userId,
        category_id: rtxn.category_id,
        type: rtxn.type,
        amount: rtxn.amount,
        note: rtxn.note,
        date: todayTimestamp,
      }),
    });
    await insertSyncEvent(userId, mutationId, "TXN", txnId, syncPayload, DB);

    // 更新 last_executed_at
    await updateRtxnLastExecutedAt(rtxn.id, userId, todayStr, DB);
  }

  // ── 處理固定預算 ──────────────────────────────────────────
  const activeBudgets = await getActiveRecurringBudgetsByUserId(userId, DB);

  for (const rbgt of activeBudgets) {
    // 當月已執行過則跳過
    if (
      rbgt.last_executed_at &&
      getMonthKeyFromDate(rbgt.last_executed_at) === currentMonthKey
    ) {
      continue;
    }

    // 自動建立預算
    const bgtId = generateUUID();
    const mutationId = generateUUID();
    const bgtVersion = 1;

    await createBudget(
      bgtId,
      userId,
      rbgt.name,
      rbgt.type,
      rbgt.goal,
      currentMonthKey,
      rbgt.category_ids,
      bgtVersion,
      DB,
    );

    // 建立 sync event，讓前端 Pull 時收到新預算
    const syncPayload = JSON.stringify({
      action: "POST",
      version: bgtVersion,
      payload: JSON.stringify({
        id: bgtId,
        user_id: userId,
        name: rbgt.name,
        type: rbgt.type,
        goal: rbgt.goal,
        month_key: currentMonthKey,
        category_ids: rbgt.category_ids,
      }),
    });
    await insertSyncEvent(userId, mutationId, "BGT", bgtId, syncPayload, DB);

    // 更新 last_executed_at
    await updateRecurringBudgetLastExecutedAt(rbgt.id, userId, todayStr, DB);
  }
}
