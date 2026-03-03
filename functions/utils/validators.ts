import type { EntityType, ActionType, EntryType } from "../types";

/**
 * 檢查值是否為非空字符串
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * 檢查值是否為有效的數字
 */
export function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * 檢查值是否為有效的實體類型
 */
export function isValidEntityType(value: unknown): value is EntityType {
  return value === "CAT" || value === "TXN" || value === "SHR";
}

/**
 * 檢查值是否為有效的操作類型
 */
export function isValidAction(value: unknown): value is ActionType {
  return value === "PUT" || value === "DELETE" || value === "POST";
}

/**
 * 檢查值是否為有效的帳目類型
 */
export function isValidEntryType(value: unknown): value is EntryType {
  return value === "EXPENSE" || value === "INCOME";
}

/**
 * 解析 payload 為字符串和對象
 */
export function parsePayload(payload: unknown): {
  payloadString: string | null;
  payloadObject: any;
} {
  if (payload === undefined || payload === null) {
    return { payloadString: null, payloadObject: null };
  }
  if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload);
      return { payloadString: payload, payloadObject: parsed };
    } catch {
      return { payloadString: payload, payloadObject: payload };
    }
  }
  return { payloadString: JSON.stringify(payload), payloadObject: payload };
}
