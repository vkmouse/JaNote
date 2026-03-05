<script setup lang="ts">
import { ref, computed, inject } from "vue";
import { useRouter } from "vue-router";
import MenuIcon from "../assets/icons/icon-menu.svg?raw";
import ArrowLeftIcon from "../assets/icons/icon-arrow-left.svg?raw";
import { useUserStore } from "../stores/userStore";

interface Props {
  mode?:
    | "default"
    | "menu-title-avatar"
    | "menu-avatar"
    | "back-toggle"
    | "back-avatar";
  title?: string;
  onBack?: () => void;
}

const props = withDefaults(defineProps<Props>(), {
  mode: "default",
  title: "JaNote",
});

const router = useRouter();
const userStore = useUserStore();

// 注入側邊欄打開方法
const openSideDrawer = inject<() => void>("openSideDrawer");

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
const handleMenuClick = () => {
  if (openSideDrawer) openSideDrawer();
};

const handleBackClick = () => {
  if (props.onBack) props.onBack();
  else router.back();
};

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
  <header class="top-nav">
    <!-- Mode: menu-avatar -->
    <template v-if="mode === 'menu-avatar'">
      <button class="nav-btn" @click="handleMenuClick" aria-label="選單">
        <span v-html="MenuIcon" class="icon"></span>
      </button>
      <div class="center-content">
        <slot></slot>
      </div>
      <div v-if="$slots.actions" class="nav-actions">
        <slot name="actions"></slot>
      </div>
      <!-- 使用 avatarWrapperWidth 動態控制寬度，確保 center-content 不被擠壓 -->
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

    <!-- Mode: menu-title-avatar -->
    <template v-else-if="mode === 'menu-title-avatar'">
      <button class="nav-btn" @click="handleMenuClick" aria-label="選單">
        <span v-html="MenuIcon" class="icon"></span>
      </button>
      <h1 class="page-title">{{ title }}</h1>
      <!-- 使用 avatarWrapperWidth 動態控制寬度，確保 page-title 不被擠壓 -->
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

    <!-- Mode: back-toggle -->
    <template v-else-if="mode === 'back-toggle'">
      <button class="nav-btn" @click="handleBackClick" aria-label="返回">
        <span v-html="ArrowLeftIcon" class="icon"></span>
      </button>
      <div class="center-content">
        <slot></slot>
      </div>
      <div class="nav-spacer"></div>
    </template>

    <!-- Mode: back-avatar -->
    <template v-else-if="mode === 'back-avatar'">
      <button class="nav-btn" @click="handleBackClick" aria-label="返回">
        <span v-html="ArrowLeftIcon" class="icon"></span>
      </button>
      <div class="center-content">
        <slot></slot>
      </div>
      <!-- 使用 avatarWrapperWidth 動態控制寬度，確保 center-content 不被擠壓 -->
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

    <!-- Default mode -->
    <template v-else>
      <slot>
        <h1 class="page-title">
          <slot name="title">{{ title }}</slot>
        </h1>
      </slot>
      <div v-if="$slots.actions" class="nav-actions">
        <slot name="actions"></slot>
      </div>
    </template>
  </header>
</template>

<style scoped>
.top-nav {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  height: 64px;
  background: var(--bg-elevated, #ffffff);
  border-bottom: 1px solid var(--border, #e0e0e0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  z-index: 9;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  flex: 1;
  text-align: center;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
  flex-shrink: 0;
}

.nav-btn:hover {
  background: var(--bg-hover, #f5f5f5);
}

.nav-btn:active {
  background: var(--bg-active, #e0e0e0);
}

.nav-btn .icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: var(--text-primary, #333);
}

.nav-btn .icon :deep(svg) {
  width: 100%;
  height: 100%;
}

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

.center-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 防止內容溢出造成與 avatar-wrapper 重疊 */
  min-width: 0;
  overflow: hidden;
}

.nav-spacer {
  width: 36px;
  flex-shrink: 0;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

@media (max-width: 768px) {
  .top-nav {
    height: 56px;
    padding: 0 16px;
  }

  .page-title {
    font-size: 18px;
  }
}
</style>
