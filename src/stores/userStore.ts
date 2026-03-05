import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { userRepository } from "../repositories/userRepository";
import { userShareRepository } from "../repositories/userShareRepository";
import type { User, UserShare } from "../types";

export interface SelectedUser {
  id: string;
  email: string;
}

export const useUserStore = defineStore("user", () => {
  // ── State ──────────────────────────────────────────────────
  /** 目前登入的使用者 */
  const currentUser = ref<User | null>(null);

  /** 正在瀏覽的共享使用者（null 表示本人） */
  const selectedUser = ref<SelectedUser | null>(null);

  /** 所有 ACTIVE 的共享帳號 */
  const userShares = ref<UserShare[]>([]);

  // ── Computed ───────────────────────────────────────────────
  /** 當前登入使用者 ID */
  const currentUserId = computed(() => currentUser.value?.id ?? "");

  /** 當前登入使用者 Email */
  const currentUserEmail = computed(() => currentUser.value?.email ?? "");

  /** 實際作用中的使用者 ID（共享或本人） */
  const activeUserId = computed(
    () => selectedUser.value?.id ?? currentUserId.value,
  );

  /** 是否正在瀏覽共享帳號（唯讀模式） */
  const isViewingShared = computed(() => selectedUser.value !== null);

  // ── Actions ────────────────────────────────────────────────
  /** 從 IndexedDB 載入使用者與共享清單 */
  async function loadUser() {
    const user = await userRepository.get();
    if (user) {
      currentUser.value = user;
    }
    const shares = await userShareRepository.getActiveShares();
    userShares.value = shares;
  }

  /** 重新整理共享清單（同步後可呼叫） */
  async function refreshShares() {
    const shares = await userShareRepository.getActiveShares();
    userShares.value = shares;
  }

  /** 設定目前瀏覽的使用者（null = 切回本人） */
  function setSelectedUser(user: SelectedUser | null) {
    selectedUser.value = user;
  }

  /** 清除使用者（登出/重置時呼叫） */
  async function clearUser() {
    const { userRepository } = await import("../repositories/userRepository");
    await userRepository.clear();
    currentUser.value = null;
    selectedUser.value = null;
    userShares.value = [];
  }

  return {
    // state
    currentUser,
    selectedUser,
    userShares,
    // computed
    currentUserId,
    currentUserEmail,
    activeUserId,
    isViewingShared,
    // actions
    loadUser,
    refreshShares,
    setSelectedUser,
    clearUser,
  };
});
