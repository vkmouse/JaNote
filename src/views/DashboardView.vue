<script setup lang="ts">
import TopNavigation from '../components/TopNavigation.vue'
</script>

<template>
  <section class="page">
    <TopNavigation>
      <template #title>帳務總覽</template>
    </TopNavigation>
    <div class="page-content">
      <!-- 內容待實作 -->
    </div>
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
}

.page-content {
  flex: 1;
  padding: 24px;
}

@media (max-width: 768px) {
  .page-content {
    padding: 16px;
  }
}
</style>
