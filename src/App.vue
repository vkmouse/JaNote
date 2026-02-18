<script setup lang="ts">
import SideNavigation from './components/SideNavigation.vue'
import BottomNavigation from './components/BottomNavigation.vue'
</script>

<template>
  <div class="app-shell">
    <SideNavigation />
    <main class="app-main">
      <router-view />
    </main>
    <BottomNavigation />
  </div>
</template>
