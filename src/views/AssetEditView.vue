<template>
  <div class="edit-page">
    <!-- Header -->
    <TopNavigation>
      <template #left><NavBack /></template>
      <template #center>
        <div class="date-display" @click="showCalendar = true">
          <span>{{ formattedDate }}</span>
        </div>
      </template>
    </TopNavigation>

    <!-- Main Content -->
    <div class="edit-content page">
      <!-- Categories Grid -->
      <div class="categories-section">
        <CategoryGrid
          :categories="assetCategories"
          :modelValue="selectedCategory"
          @update:modelValue="selectedCategory = $event as string"
        />
      </div>

      <!-- Amount and Asset Name Input -->
      <AmountInput
        :categoryName="selectedCategory || '其他'"
        :formattedAmount="formattedAmount"
        type="INCOME"
        v-model="assetName"
        placeholder="資產名稱"
      />

      <!-- Calculator Panel -->
      <div class="input-panel">
        <CalculatorPad
          v-model="amount"
          :canConfirm="canSave"
          @confirm="save"
        />
      </div>
    </div>

    <CalendarPicker v-model:open="showCalendar" v-model="currentDate" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import TopNavigation from "../components/TopNavigation.vue";
import NavBack from "../components/NavBack.vue";
import CalendarPicker from "../components/CalendarPicker.vue";
import CalculatorPad from "../components/CalculatorPad.vue";
import CategoryGrid from "../components/CategoryGrid.vue";
import AmountInput from "../components/AmountInput.vue";
import type { AssetCategory, Category } from "../types";
import { useAssetStore, ASSET_CATEGORIES } from "../stores/assetStore";

const router = useRouter();
const assetStore = useAssetStore();

const currentDate = ref<number>(Date.now());
const showCalendar = ref(false);
const selectedCategory = ref<string>("");
const assetName = ref<string>("");
const amount = ref<string>("");

// CategoryGrid 吃 Category[]，以分類名稱當 id 包一層
const assetCategories: Category[] = ASSET_CATEGORIES.map((name, i) => ({
  id: name,
  user_id: "",
  name,
  type: "INCOME",
  sortOrder: i,
  version: 0,
  is_deleted: 0,
}));

const formattedAmount = computed(() => {
  const num = amount.value || "0";
  const isNegative = num.startsWith("-");
  const abs = isNegative ? num.slice(1) : num;
  if (/^[0-9.]+$/.test(abs)) {
    const parts = abs.split(".");
    parts[0] = parts[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (isNegative ? "-" : "") + parts.join(".");
  }
  return num;
});

const formattedDate = computed(() => {
  const date = new Date(currentDate.value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${year}年${month}月${day} 星期${weekDays[date.getDay()]}`;
});

// 金額允許 0（代表已賣出／結清），不允許負數
const canSave = computed(() => {
  const value = parseFloat(amount.value);
  return !!(
    selectedCategory.value &&
    assetName.value.trim() &&
    !isNaN(value) &&
    value >= 0
  );
});

function save() {
  if (!canSave.value) return;
  assetStore.addRecord({
    category: selectedCategory.value as AssetCategory,
    name: assetName.value,
    amount: parseFloat(amount.value),
    date: currentDate.value,
  });
  router.back();
}
</script>

<style scoped>
.edit-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-page);
  overflow: hidden;
}

.edit-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.categories-section {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 13px 12px 0;
  border-bottom: 2px solid var(--border-primary);
}

.input-panel {
  flex-shrink: 0;
  background: var(--calc-panel-bg);
  margin: 0;
  border-radius: 0;
  padding: 16px;
}

.date-display {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  cursor: pointer;
  user-select: none;
}
</style>
