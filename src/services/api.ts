import { getAccessHeaders, refreshAccessToken } from "./auth";

/**
 * 帶著 Access edge 用的 Client Id / Secret header + app 自己的 JWT Cookie
 * （`credentials: 'include'`）呼叫 `/api/*`；收到 401（access_token 過期）時，
 * 自動打一次 `/api/auth/refresh` 換新的 access token，成功的話原始請求重打
 * 一次，失敗就把原本的 401 回應原封不動回傳給呼叫端（呼叫端走原本的錯誤處理）。
 *
 * 專案裡所有會打 `/api/*` 業務端點的地方（syncStore.ts、QuickEntryView.vue）
 * 都應該透過這支函式呼叫，避免 401 重試邏輯在多個地方各寫一份。
 * `/api/auth/login`、`/api/auth/refresh` 本身不透過這支函式呼叫。
 */
export async function authorizedFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const withAuth = (): RequestInit => ({
    ...init,
    credentials: "include",
    headers: { ...getAccessHeaders(), ...(init.headers ?? {}) },
  });

  let res = await fetch(input, withAuth());
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await fetch(input, withAuth());
    }
  }
  return res;
}
