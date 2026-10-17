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
      <!-- 不可動用徽章：標記這項資產（分類＋名稱）平常不計入可動用資產，例如退休基金 -->
      <div class="header-section">
        <div class="left-controls">
          <button
            type="button"
            :class="['page-badge', isLocked ? 'recurring-badge-active' : 'recurring-badge-inactive']"
            :aria-pressed="isLocked"
            @click="isLocked = !isLocked"
          >
            <span class="page-badge-icon" v-html="iconLock"></span>
            <span class="page-badge-label">不可動用</span>
          </button>
        </div>
      </div>

      <!-- Categories Grid -->
      <div class="categories-section">
        <CategoryGrid
          :categories="assetStore.visibleCategories"
          :modelValue="selectedCategoryId"
          @update:modelValue="selectedCategoryId = $event as string"
          @select="onCategorySelect"
        />
      </div>

      <!-- Amount and Asset Name Input -->
      <AmountInput
        :categoryName="selectedCategoryName"
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
import { ref, computed, onMounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import TopNavigation from "../components/TopNavigation.vue";
import NavBack from "../components/NavBack.vue";
import CalendarPicker from "../components/CalendarPicker.vue";
import CalculatorPad from "../components/CalculatorPad.vue";
import CategoryGrid from "../components/CategoryGrid.vue";
import AmountInput from "../components/AmountInput.vue";
import { useAssetStore } from "../stores/assetStore";
import { useUserStore } from "../stores/userStore";
import { iconLock } from "../utils/icons";
import { isAssetLocked, setAssetLocked } from "../composables/useLockedAssets";
import type { Category } from "../types";

const router = useRouter();
const route = useRoute();
const assetStore = useAssetStore();
const userStore = useUserStore();

const editingId = ref<string | null>(null);
const currentDate = ref<number>(Date.now());
const showCalendar = ref(false);
const selectedCategoryId = ref<string>("");
const assetName = ref<string>("");
const amount = ref<string>("");
const previousAutoNote = ref<string | null>(null);
const isLocked = ref(false);

// 徽章反映「目前分類＋名稱」這項資產是否已被標記為不可動用；
// 為既有的不可動用資產新增紀錄時會自動亮起，避免存檔時誤把它取消標記
watch([selectedCategoryId, assetName], ([categoryId, name]) => {
  isLocked.value =
    !!categoryId && !!name.trim() && isAssetLocked(categoryId, name);
});

const selectedCategoryName = computed(() =>
  selectedCategoryId.value
    ? assetStore.getCategoryName(selectedCategoryId.value)
    : "其他",
);

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
    selectedCategoryId.value &&
    assetName.value.trim() &&
    !isNaN(value) &&
    value >= 0
  );
});

const onCategorySelect = (category: Category) => {
  if (!assetName.value || assetName.value === previousAutoNote.value) {
    assetName.value = category.name;
    previousAutoNote.value = category.name;
  } else {
    previousAutoNote.value = null;
  }
};

watch(assetName, (newVal) => {
  if (previousAutoNote.value && newVal !== previousAutoNote.value) {
    previousAutoNote.value = null;
  }
});

async function save() {
  if (!canSave.value) return;
  if (editingId.value) {
    await assetStore.updateRecord({
      id: editingId.value,
      category_id: selectedCategoryId.value,
      name: assetName.value,
      amount: parseFloat(amount.value),
      date: currentDate.value,
    });
  } else {
    await assetStore.addRecord({
      category_id: selectedCategoryId.value,
      name: assetName.value,
      amount: parseFloat(amount.value),
      date: currentDate.value,
    });
  }
  if (isAssetLocked(selectedCategoryId.value, assetName.value) !== isLocked.value) {
    setAssetLocked(selectedCategoryId.value, assetName.value, isLocked.value);
  }
  router.back();
}

onMounted(async () => {
  await userStore.loadUser();
  await assetStore.loadCategories();

  const id = route.params.id as string | undefined;
  if (!id) {
    // 套用上一頁透過 history.state 帶入的初始值（例如左滑複製）
    const state = window.history.state as
      | {
          prefill?: {
            name?: string;
            amount?: number;
            category_id?: string | null;
          };
        }
      | undefined;
    if (state?.prefill) {
      assetName.value = state.prefill.name ?? "";
      amount.value = state.prefill.amount != null ? String(state.prefill.amount) : "";
      selectedCategoryId.value = state.prefill.category_id ?? "";
    }
    return;
  }
  const record = await assetStore.getRecordById(id);
  if (!record) return;
  editingId.value = id;
  selectedCategoryId.value = record.category_id;
  assetName.value = record.name;
  amount.value = String(record.amount);
  currentDate.value = record.date;
});
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

.header-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 12px;
}

.left-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.categories-section {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 0 12px;
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
