/// <reference path="../types.d.ts" />

import type { AuthContext, Env, DraftRequest, DraftResponse } from "../types";
import { isNonEmptyString } from "../utils/validators";
import { getUserIdByEmail } from "../repositories/userRepository";
import { getActiveExpenseCategories } from "../repositories/categoryRepository";
import {
  parseRawTextWithGemini,
  buildExpenseDrafts,
  getTaipeiTodayString,
} from "../services/draftService";

const MAX_RAW_TEXT_LENGTH = 2000;

/**
 * 接收使用者記事本原始文字，呼叫 Gemini 拆解成多筆記帳草稿。
 * 草稿只是暫存結果，不寫入資料庫。
 */
export const onRequest: PagesFunction<Env, any, AuthContext> = async (
  context,
) => {
  const { DB, GEMINI_API_KEY } = context.env;
  const userEmail = context.data.email;

  if (context.request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: DraftRequest;
  try {
    body = (await context.request.json()) as DraftRequest;
  } catch {
    return jsonResponse(
      { error: "Invalid JSON body", error_code: "INVALID_BODY" },
      { status: 400 },
    );
  }

  if (!isNonEmptyString(body?.raw_text)) {
    return jsonResponse(
      { error: "raw_text is required", error_code: "INVALID_BODY" },
      { status: 400 },
    );
  }

  if (body.raw_text.length > MAX_RAW_TEXT_LENGTH) {
    return jsonResponse(
      { error: "raw_text exceeds max length of 2000", error_code: "TEXT_TOO_LONG" },
      { status: 400 },
    );
  }

  const userId = await getUserIdByEmail(userEmail, DB);

  // 只取該使用者未刪除的 EXPENSE 分類，name 陣列餵給 AI，id 留在後端做比對
  const categories = await getActiveExpenseCategories(userId, DB);
  const categoryNames = categories.map((c) => c.name);
  const todayStr = getTaipeiTodayString();

  let rawDrafts;
  try {
    rawDrafts = await parseRawTextWithGemini(
      body.raw_text,
      categoryNames,
      GEMINI_API_KEY,
      todayStr,
    );
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message ?? "AI provider error", error_code: "AI_PROVIDER_ERROR" },
      { status: 502 },
    );
  }

  try {
    const drafts = buildExpenseDrafts(rawDrafts, categories, todayStr);
    return jsonResponse({ drafts } satisfies DraftResponse, { status: 200 });
  } catch (error: any) {
    console.error("Failed to build drafts:", error);
    return jsonResponse(
      { error: "Internal error", error_code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
};

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}
