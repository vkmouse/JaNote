/**
 * 登入端點。
 *
 * 這條路徑在 Access edge 是「一般受保護路徑」，Cloudflare Access 會先驗證
 * 呼叫端的 Service Token，通過後才會把請求連同 `Cf-Access-Jwt-Assertion`
 * header 一起放行到這裡。
 *
 * 流程：
 *   ① 驗證 Cf-Access-Jwt-Assertion 簽章（JWKS），取得已驗證的 common_name
 *   ② common_name 查 SERVICE_IDENTITY_MAP 對照表 → email
 *      （查不到就是這個 Service Token 沒有登記，直接 401，不會自動註冊）
 *   ③ email 查（或自動建立）users 表 → userId
 *      如果是全新建立的使用者，順便初始化預設的記帳分類
 *      （這段邏輯原本在 functions/api/sync.ts，因為現在只有登入當下需要
 *      查/建 DB，其餘 /api/* 請求都直接吃 JWT payload 裡的 userId，
 *      整段搬過來這裡）
 *   ④ 簽發 access token（8hr）+ refresh token（10 年），各自用 httpOnly
 *      Cookie（Path=/api）回傳，並回應 { email, userId }
 */
import type { AuthContext, Env } from "../../types";
import { getUserIdByEmail as getUserIdByEmailRepo } from "../../repositories/userRepository";
import { initializeDefaultCategories } from "../../repositories/categoryRepository";
import { resolveEmailByCommonName, verifyAccessAssertion } from "../../utils/access";
import {
  signAccessToken,
  signRefreshToken,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from "../../utils/jwt";
import {
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  buildAppCookie,
} from "../../utils/cookie";

/**
 * 根據使用者的 Email 取得 User ID。
 * 如果這是一個全新建立的使用者，會順便幫他初始化預設的記帳分類。
 */
async function getOrCreateUserId(email: string, DB: D1Database): Promise<string> {
  const userId = await getUserIdByEmailRepo(email, DB);

  // 檢查這是否為新使用者（剛建立的）
  const existing = await DB.prepare("SELECT created_at FROM users WHERE id = ?")
    .bind(userId)
    .first<{ created_at: string }>();

  if (existing) {
    const createdAt = new Date(existing.created_at);
    const now = new Date();
    const diffSeconds = (now.getTime() - createdAt.getTime()) / 1000;

    // 如果使用者剛被建立，則初始化預設分類
    if (diffSeconds < 1) {
      await initializeDefaultCategories(userId, DB);
    }
  }

  return userId;
}

export const onRequest: PagesFunction<Env, any, AuthContext> = async (
  context,
) => {
  const { env, request } = context;

  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!env.APP_JWT_SECRET) {
    console.error("[auth] 缺少環境變數 APP_JWT_SECRET");
    return new Response("Unauthorized", { status: 401 });
  }

  const assertion = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!assertion) {
    return new Response("Unauthorized", { status: 401 });
  }

  const commonName = await verifyAccessAssertion(env, assertion);
  if (!commonName) {
    return new Response("Unauthorized", { status: 401 });
  }

  const email = resolveEmailByCommonName(env.SERVICE_IDENTITY_MAP, commonName);
  if (!email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = await getOrCreateUserId(email, env.DB);

  const identity = { email, userId };
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(env.APP_JWT_SECRET, identity),
    signRefreshToken(env.APP_JWT_SECRET, identity),
  ]);

  const response = Response.json({ email, userId });
  response.headers.append(
    "Set-Cookie",
    buildAppCookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, ACCESS_TOKEN_TTL_SECONDS),
  );
  response.headers.append(
    "Set-Cookie",
    buildAppCookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, REFRESH_TOKEN_TTL_SECONDS),
  );
  return response;
};
