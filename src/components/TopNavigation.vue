<script setup lang="ts">
import { ref, onMounted, inject } from 'vue'
import { useRouter } from 'vue-router'
import MenuIcon from '../assets/icons/icon-menu.svg?raw'
import ArrowLeftIcon from '../assets/icons/icon-arrow-left.svg?raw'
import { userRepository } from '../repositories/userRepository'

interface Props {
  mode?: 'default' | 'menu-title-avatar' | 'back-toggle'
  title?: string
  onBack?: () => void
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'default',
  title: 'JaNote'
})

const router = useRouter()
const userEmail = ref<string>('')
const userInitial = ref<string>('U')

// 注入側邊欄打開方法
const openSideDrawer = inject<() => void>('openSideDrawer')

onMounted(async () => {
  const user = await userRepository.get()
  if (user && user.email) {
    userEmail.value = user.email
    userInitial.value = user.email.charAt(0).toUpperCase()
  }
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
</script>

<template>
  <header class="top-nav">
    <!-- Mode: menu-title-avatar -->
    <template v-if="mode === 'menu-title-avatar'">
      <button class="nav-btn" @click="handleMenuClick" aria-label="選單">
        <span v-html="MenuIcon" class="icon"></span>
      </button>
      <h1 class="page-title">{{ title }}</h1>
      <div v-if="userEmail" class="avatar" :title="userEmail">
        {{ userInitial }}
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
  gap: 16px;
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
  width: 40px;
  height: 40px;
  padding: 8px;
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

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--janote-income);
  color: white;
  border-radius: 50%;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  user-select: none;
}

.center-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-spacer {
  width: 40px;
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
    gap: 12px;
  }

  .page-title {
    font-size: 18px;
  }

  .nav-btn {
    width: 36px;
    height: 36px;
  }

  .avatar {
    width: 36px;
    height: 36px;
    font-size: 14px;
  }

  .nav-spacer {
    width: 36px;
  }
}
</style>
