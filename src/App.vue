<script setup lang="ts">
import Navigation from './components/Navigation.vue'
</script>

<template>
  <div class="app-shell">
    <Navigation />
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>
