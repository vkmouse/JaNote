<script setup lang="ts">
import { ref, onMounted, inject, computed } from 'vue'
import { useRouter } from 'vue-router'
import MenuIcon from '../assets/icons/icon-menu.svg?raw'
import ArrowLeftIcon from '../assets/icons/icon-arrow-left.svg?raw'
import { userRepository } from '../repositories/userRepository'
import { userShareRepository } from '../repositories/userShareRepository'
import type { UserShare } from '../types'

interface Props {
  mode?: 'default' | 'menu-title-avatar' | 'menu-avatar' | 'back-toggle' | 'back-avatar'
  title?: string
  onBack?: () => void
}

interface SelectedUser {
  id: string
  email: string
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'default',
  title: 'JaNote'
})

const emit = defineEmits<{
  (e: 'user-changed', user: SelectedUser | null): void
}>()

const router = useRouter()
const currentUserId = ref<string>('')
const userEmail = ref<string>('')
const userInitial = ref<string>('U')
const userShares = ref<UserShare[]>([])
const isShowingSharedAccount = ref(false)
const currentShareIndex = ref(0)

// 注入側邊欄打開方法
const openSideDrawer = inject<() => void>('openSideDrawer')

// 計算當前顯示的帳號信息
const currentAvatarInfo = computed(() => {
  if (isShowingSharedAccount.value) {
    const share = userShares.value[currentShareIndex.value]
    if (share) {
      // 判斷本人是 sender 還是 receiver
      const isCurrentUserSender = share.sender_id === currentUserId.value

      // 決定誰是共享對象（另一方）
      const otherEmail = isCurrentUserSender ? share.receiver_email : share.sender_email
      const otherInitial = otherEmail.charAt(0).toUpperCase()

      return {
        initial: otherInitial,   // 共享對象的首字母
        email: otherEmail,       // 共享對象的 email
        isShared: true,
        ownerInitial: userInitial.value,  // 本人首字母
        ownerEmail: userEmail.value       // 本人 email
      }
    }
  }
  return {
    initial: userInitial.value,
    email: userEmail.value,
    isShared: false
  }
})

// 是否可以切換頭貼（有有效的共享帳號）
const canSwitchAvatar = computed(() => {
  return userShares.value.length > 0
})

// 根據是否展示共享帳號，動態控制 avatar-wrapper 的寬度
// - 一般模式：36px（只顯示單一頭貼）
// - 共享模式：54px（顯示雙頭貼，需要更多空間）
const avatarWrapperWidth = computed(() => {
  return isShowingSharedAccount.value ? '54px' : '36px'
})

onMounted(async () => {
  const user = await userRepository.get()
  if (user?.id) {
    currentUserId.value = user.id
  }
  if (user && user.email) {
    userEmail.value = user.email
    userInitial.value = user.email.charAt(0).toUpperCase()
  }

  // 獲取有效的共享帳號列表（ACTIVE 且未刪除）
  const activeShares = await userShareRepository.getActiveShares()
  userShares.value = activeShares
})

const handleMenuClick = () => {
  if (openSideDrawer) {
    openSideDrawer()
  }
}

const handleBackClick = () => {
  if (props.onBack) {
    props.onBack()
  } else {
    router.back()
  }
}

const handleAvatarClick = () => {
  if (!canSwitchAvatar.value) return

  if (!isShowingSharedAccount.value) {
    // 切換為共享帳號
    isShowingSharedAccount.value = true
    currentShareIndex.value = 0
    const share = userShares.value[0]
    if (share) {
      // 根據本人角色，判斷共享對象
      const isCurrentUserSender = share.sender_id === currentUserId.value
      if (isCurrentUserSender) {
        emit('user-changed', { id: share.receiver_id, email: share.receiver_email })
      } else {
        emit('user-changed', { id: share.sender_id, email: share.sender_email })
      }
    }
  } else {
    // 嘗試下一個共享帳號
    const nextIndex = currentShareIndex.value + 1
    if (nextIndex < userShares.value.length) {
      currentShareIndex.value = nextIndex
      const share = userShares.value[nextIndex]
      if (share) {
        // 根據本人角色，判斷共享對象
        const isCurrentUserSender = share.sender_id === currentUserId.value
        if (isCurrentUserSender) {
          emit('user-changed', { id: share.receiver_id, email: share.receiver_email })
        } else {
          emit('user-changed', { id: share.sender_id, email: share.sender_email })
        }
      }
    } else {
      // 沒有更多共享帳號，切回自己
      isShowingSharedAccount.value = false
      currentShareIndex.value = 0
      emit('user-changed', null)
    }
  }
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
        v-if="userEmail"
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
        v-if="userEmail"
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
        v-if="userEmail"
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
        <h1 class="page-title"><slot name="title">{{ title }}</slot></h1>
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