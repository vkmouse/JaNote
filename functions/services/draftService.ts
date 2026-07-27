import type { AiRawDraft, ExpenseDraft } from "../types";
import { isValidDateString } from "../utils/validators";

const GEMINI_TIMEOUT_MS = 15_000;
const MAX_DRAFTS = 20;
const RESPONSE_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      note: { type: "string" },
      amount: { type: "number" },
      category_name: { type: "string", nullable: true },
      date: { type: "string", nullable: true },
    },
    required: ["note", "amount", "category_name", "date"],
  },
};

/** 取得伺服器當下日期（Asia/Taipei），格式 YYYY-MM-DD，供 prompt 使用 */
export function getTaipeiTodayString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** 將 YYYY-MM-DD（Asia/Taipei，無 DST，固定 UTC+8）轉為當日 00:00 的 unix ms */
function taipeiDateStringToUnixMs(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day, 0, 0, 0) - 8 * 60 * 60 * 1000;
}

function buildPrompt(rawText: string, categoryNames: string[], todayStr: string): string {
  return `你是一個記帳文字解析助手。使用者會貼上一段自由格式的中文（或中英混雜）文字，內容描述他今天或最近的消費。

請將文字拆解成多筆「支出」項目，每一筆輸出一個物件，欄位如下：
- note: string，這筆消費的簡短描述（例如「大冰奶」「午餐便當」）。
- amount: number，這筆消費的金額。若同一段文字出現多個數字造成歧義（例如「買了3件衣服共900」），請取「這筆消費的總金額」（900），而不是數量（3）。折扣運算（例如「原價200打8折」）不需要自己算出結果，若沒有明確金額，這筆不要輸出。
- category_name: string 或 null。你只能從下面這份「既有分類名稱清單」中「原樣」選一個名稱輸出，絕對不可以自己發明清單以外的名稱。如果真的判斷不出來對應哪個分類，輸出 null，不要硬猜。
- date: string 或 null，格式必須是 YYYY-MM-DD 的「明確日期」（例如 "2026-07-27"），絕對不可以輸出 "today"、"yesterday" 等語意詞。今天的日期是 ${todayStr}（Asia/Taipei 時區），請以此為基準，把文字中的相對時間詞（今天、昨天、前天等）換算成真實日期。早上/中午/晚上等時段用詞只影響你對句子的理解，不影響輸出（date 只到日的精度）。若文字完全沒有時間線索，輸出 null。本期不支援解析未來日期，若語句明顯指向未來（例如「下週五要繳的錢」），可以忽略該筆。

既有分類名稱清單：
${JSON.stringify(categoryNames)}

規則：
1. 只處理支出，不要輸出收入項目。
2. 單次最多輸出 20 筆，超過的部分忽略。
3. 只輸出符合 JSON Schema 的陣列，不要有任何其他文字、Markdown 標記或前後綴。
4. 文字中若完全沒有可以解析出的消費，輸出空陣列 []。

使用者原始文字：
"""
${rawText}
"""`;
}

async function callGeminiOnce(
  prompt: string,
  apiKey: string,
  model: string,
): Promise<AiRawDraft[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini API responded with ${response.status}`);
    }

    const data: any = await response.json();
    const text: string | undefined =
      data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("Gemini API returned no content");
    }

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error("Gemini API returned non-array JSON");
    }
    return parsed as AiRawDraft[];
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * 呼叫 Gemini 解析文字，逾時 15 秒；回傳非合法 JSON 時最多自動重試 1 次。
 */
export async function parseRawTextWithGemini(
  rawText: string,
  categoryNames: string[],
  apiKey: string | undefined,
  model: string | undefined,
  todayStr: string = getTaipeiTodayString(),
): Promise<AiRawDraft[]> {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  if (!model) {
    throw new Error("GEMINI_MODEL is not configured");
  }

  const prompt = buildPrompt(rawText, categoryNames, todayStr);

  try {
    return await callGeminiOnce(prompt, apiKey, model);
  } catch {
    // 第一次失敗（逾時、非合法 JSON 等），重試一次
    return await callGeminiOnce(prompt, apiKey, model);
  }
}

/**
 * 把 Gemini 的原始輸出轉成前端可用的草稿：
 * category_name 比對成 category_id、date 驗證/fallback、amount 與 note 不合法的整筆捨棄。
 */
export function buildExpenseDrafts(
  rawDrafts: AiRawDraft[],
  categories: Pick<{ id: string; name: string }, "id" | "name">[],
  todayStr: string = getTaipeiTodayString(),
): ExpenseDraft[] {
  const fallbackDateMs = taipeiDateStringToUnixMs(todayStr);
  const drafts: ExpenseDraft[] = [];

  for (const raw of rawDrafts) {
    // amount 必須 > 0 且為有限數字，否則整筆捨棄
    if (typeof raw?.amount !== "number" || !Number.isFinite(raw.amount) || raw.amount <= 0) {
      continue;
    }

    // note 非空字串（trim 後）才保留
    const note = typeof raw?.note === "string" ? raw.note.trim() : "";
    if (!note) continue;

    // category_name → category_id：精準字串比對（trim 頭尾空白），比對不到一律 null
    let category_id: string | null = null;
    if (typeof raw?.category_name === "string") {
      const trimmedName = raw.category_name.trim();
      const matched = categories.find((c) => c.name === trimmedName);
      if (matched) category_id = matched.id;
    }

    // date：合法 YYYY-MM-DD 才轉換，否則 fallback 為伺服器當下日期
    let date: number;
    if (isValidDateString(raw?.date)) {
      date = taipeiDateStringToUnixMs(raw.date);
    } else {
      date = fallbackDateMs;
    }

    drafts.push({
      draft_id: crypto.randomUUID(),
      note,
      amount: raw.amount,
      category_id,
      date,
    });
  }

  // 筆數上限防呆：即使 Gemini 沒守住 20 筆限制，仍強制 slice
  return drafts.slice(0, MAX_DRAFTS);
}
