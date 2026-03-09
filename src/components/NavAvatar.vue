<script setup lang="ts">
import { ref, computed } from "vue";
import { useUserStore } from "../stores/userStore";

const userStore = useUserStore();

// ── 本地 UI 狀態（純呈現，不屬於 store）──────────────────
/** 目前輪替到第幾個共享帳號 */
const currentShareIndex = ref(0);

// ── 呈現層 Computed ────────────────────────────────────────
const canSwitchAvatar = computed(() => userStore.userShares.length > 0);

const avatarWrapperWidth = computed(() =>
  userStore.isViewingShared ? "54px" : "36px",
);

const currentAvatarInfo = computed(() => {
  const ownerEmail = userStore.currentUserEmail;
  const ownerInitial = ownerEmail ? ownerEmail.charAt(0).toUpperCase() : "U";

  if (userStore.isViewingShared) {
    const share = userStore.userShares[currentShareIndex.value];
    if (share) {
      const isOwnerSender = share.sender_id === userStore.currentUserId;
      const otherEmail = isOwnerSender
        ? share.receiver_email
        : share.sender_email;
      return {
        initial: otherEmail.charAt(0).toUpperCase(),
        email: otherEmail,
        isShared: true,
        ownerInitial,
        ownerEmail,
      };
    }
  }
  return {
    initial: ownerInitial,
    email: ownerEmail,
    isShared: false,
    ownerInitial,
    ownerEmail,
  };
});

// ── Handlers ───────────────────────────────────────────────
/** 本人 → 共享1 → 共享2 … → 本人 循環切換 */
const handleAvatarClick = () => {
  if (!canSwitchAvatar.value) return;

  const shares = userStore.userShares;

  if (!userStore.isViewingShared) {
    // 本人 → 第一個共享
    currentShareIndex.value = 0;
    const firstShare = shares[0];
    if (firstShare) {
      userStore.setSelectedUser(_resolveShare(firstShare));
    }
  } else {
    const nextIndex = currentShareIndex.value + 1;
    if (nextIndex < shares.length) {
      currentShareIndex.value = nextIndex;
      const nextShare = shares[nextIndex];
      if (nextShare) {
        userStore.setSelectedUser(_resolveShare(nextShare));
      }
    } else {
      // 回到本人
      currentShareIndex.value = 0;
      userStore.setSelectedUser(null);
    }
  }
};

/** 從 UserShare 解析出「另一方」的 id/email */
function _resolveShare(
  share: NonNullable<(typeof userStore.userShares)[number]>,
) {
  const isOwnerSender = share.sender_id === userStore.currentUserId;
  return isOwnerSender
    ? { id: share.receiver_id, email: share.receiver_email }
    : { id: share.sender_id, email: share.sender_email };
}
</script>

<template>
  <div
    v-if="currentAvatarInfo.email"
    class="avatar-wrapper"
    :class="{ 'can-switch': canSwitchAvatar }"
    :style="{ width: avatarWrapperWidth }"
    @click="handleAvatarClick"
    :title="currentAvatarInfo.email"
  >
    <div v-if="currentAvatarInfo.isShared" class="avatar-shared">
      <!-- 本人頭貼（右側，半透明背景） -->
      <div class="avatar avatar-owner">
        {{ currentAvatarInfo.ownerInitial }}
      </div>
      <!-- 共享對象頭貼（左側前景） -->
      <div class="avatar avatar-sharer">
        {{ currentAvatarInfo.initial }}
      </div>
    </div>
    <div v-else class="avatar" :class="{ 'has-shares': canSwitchAvatar }">
      {{ currentAvatarInfo.initial }}
    </div>
  </div>
</template>

<style scoped>
.avatar-wrapper {
  /*
   * 預設寬度 36px（單一頭貼）
   * 共享模式寬度 54px（雙頭貼）透過 inline style 動態切換
   * 使用 transition 讓寬度變化有動畫效果，避免版面跳動
   */
  flex-shrink: 0;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  user-select: none;
  transition: width 0.2s ease;
  /* 預設寬度由 inline style 的 avatarWrapperWidth 控制，此處作為 fallback */
  width: 36px;
}

.avatar-wrapper.can-switch {
  cursor: pointer;
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--janote-income);
  color: white;
  border-radius: 50%;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  user-select: none;
  transition: opacity 0.2s;
  border: 2px solid var(--text-primary);
}

.avatar.has-shares {
  cursor: pointer;
}

.avatar-shared {
  /*
   * 共享雙頭貼容器
   * 寬度固定 54px = 36px（本人頭貼）+ 18px（共享者頭貼露出部分）
   * 高度對齊單頭貼高度
   */
  position: relative;
  width: 54px;
  height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

/* 共享對象頭貼（左側，前景） */
.avatar-sharer {
  position: absolute;
  left: 0;
  top: 0;
  width: 36px;
  height: 36px;
  background: var(--janote-expense, #ff6b6b);
  color: var(--text-primary, #333);
  font-size: 14px;
  z-index: 1;
  border-radius: 50%;
  border: 2px solid var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

/* 本人頭貼（右側，半透明） */
.avatar-owner {
  position: absolute;
  right: 0;
  top: 0;
  width: 36px;
  height: 36px;
  opacity: 0.5;
  z-index: 0;
  border-radius: 50%;
  border: 2px solid var(--text-primary);
  background: var(--janote-income);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
}
</style>
