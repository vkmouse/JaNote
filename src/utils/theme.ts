import { ref } from "vue";

export type ThemePreference = "light" | "dark";

const LS_THEME_KEY = "janote_theme";

// 對應 base.css 的 --bg-page 淺色／深色數值，讓瀏覽器狀態列/網址列跟頁面背景一致
const THEME_COLOR_LIGHT = "#FFFFFF";
const THEME_COLOR_DARK = "#17150F";

function loadTheme(): ThemePreference {
  try {
    const saved = localStorage.getItem(LS_THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // 忽略讀取失敗（例如無痕模式），預設淺色
  }
  return "light";
}

/** 目前的主題偏好，畫面上任何地方都可以直接讀取這個 ref 顯示目前狀態 */
export const theme = ref<ThemePreference>(loadTheme());

function applyTheme(value: ThemePreference) {
  // base.css 只定義了 [data-theme="dark"] 覆寫，淺色是預設值，不需要另外掛屬性
  if (value === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", value === "dark" ? THEME_COLOR_DARK : THEME_COLOR_LIGHT);
  }
}

/** 切換並持久化主題偏好（存裝置本機 localStorage，不跟帳號同步） */
export function setTheme(value: ThemePreference): void {
  theme.value = value;
  applyTheme(value);
  try {
    localStorage.setItem(LS_THEME_KEY, value);
  } catch {
    // 忽略寫入失敗
  }
}

/** App 啟動時呼叫一次，把已存的偏好套用到畫面上；務必在 Vue app 掛載前呼叫，避免先閃白色再變深色 */
export function initTheme(): void {
  applyTheme(theme.value);
}
