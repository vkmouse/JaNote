<template>
  <section class="asset-trend-page">
    <TopNavigation>
      <template #left>
        <NavMenu />
        <NavSearch to="/assets/search" />
      </template>
      <template #center>
        <div class="year-display" @click="showYearPicker = true">
          <span>{{ selectedYear }}年</span>
        </div>
      </template>
      <template #right><NavSync /><NavAvatar /></template>
    </TopNavigation>

    <YearPicker v-model:open="showYearPicker" v-model:year="selectedYear" />

    <div class="page-content page">
      <AssetTrendChart :year="selectedYear" />
    </div>

    <AssetBottomBar />
  </section>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from "vue";
import { useRouter, useRoute } from "vue-router";
import TopNavigation from "../components/TopNavigation.vue";
import NavMenu from "../components/NavMenu.vue";
import NavSearch from "../components/NavSearch.vue";
import NavSync from "../components/NavSync.vue";
import NavAvatar from "../components/NavAvatar.vue";
import YearPicker from "../components/YearPicker.vue";
import AssetBottomBar from "../components/AssetBottomBar.vue";
import AssetTrendChart from "../components/AssetTrendChart.vue";
import { useAssetStore } from "../stores/assetStore";
import { useUserStore } from "../stores/userStore";

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const assetStore = useAssetStore();

const selectedYear = ref(new Date().getFullYear());
const showYearPicker = ref(false);

// 年份同步到 query，重新整理或從其他頁返回時能維持原本檢視的年份
const isInitialized = ref(false);

watch(selectedYear, (year) => {
  if (!isInitialized.value) return;
  router.replace({ query: { year: String(year) } });
});

onMounted(async () => {
  if (typeof route.query.year === "string") {
    const y = parseInt(route.query.year);
    if (!isNaN(y)) selectedYear.value = y;
  }
  await nextTick();
  isInitialized.value = true;
  await userStore.loadUser();
  await Promise.all([assetStore.loadCategories(), assetStore.loadRecords()]);
});
</script>

<style scoped>
.asset-trend-page {
  display: flex;
  flex-direction: column;
}

.year-display {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  cursor: pointer;
  user-select: none;
}

.page-content {
  flex: 1;
  background: var(--bg-page);
  padding-bottom: 100px;
}
</style>
