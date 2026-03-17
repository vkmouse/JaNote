<template>
  <div v-if="open" class="year-picker-overlay" @click="close">
    <div class="year-picker" @click.stop>
      <h3>選擇年份</h3>
      <div class="picker-controls">
        <button @click="previousDecade">
          <span v-html="iconChevronLeft" class="picker-arrow"></span>
        </button>
        <span class="picker-range">{{ startYear }} - {{ endYear }}</span>
        <button @click="nextDecade">
          <span v-html="iconChevronRight" class="picker-arrow"></span>
        </button>
      </div>
      <div class="year-grid">
        <button
          v-for="yearOption in years"
          :key="yearOption"
          :class="['year-btn', { active: yearOption === year }]"
          @click="selectYear(yearOption)"
        >
          {{ yearOption }}
        </button>
      </div>
      <button class="confirm-btn" @click="confirm">確認</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { iconChevronLeft, iconChevronRight } from "../utils/icons";

const props = defineProps<{ open: boolean; year: number }>();
const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "update:year", value: number): void;
  (e: "confirm"): void;
}>();

const startYear = ref(Math.floor(props.year / 10) * 10);
const endYear = computed(() => startYear.value + 9);

const years = computed(() => {
  const result = [];
  for (let i = 0; i < 10; i++) {
    result.push(startYear.value + i);
  }
  return result;
});

const previousDecade = () => {
  startYear.value -= 10;
};

const nextDecade = () => {
  startYear.value += 10;
};

const selectYear = (yearValue: number) => {
  emit("update:year", yearValue);
};

const close = () => emit("update:open", false);
const confirm = () => {
  emit("confirm");
  close();
};

// 當 open 變為 true 時，重置 startYear 以確保當前年份在顯示範圍內
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      startYear.value = Math.floor(props.year / 10) * 10;
    }
  },
);
</script>

<style scoped>
.year-picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.year-picker {
  background: var(--bg-page);
  border-radius: 16px;
  padding: 24px;
  min-width: 320px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.year-picker h3 {
  margin: 0 0 24px;
  text-align: center;
  font-size: 18px;
  color: var(--text-primary);
}

.picker-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
  position: relative;
  width: 100%;
}

.picker-controls button {
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--text-primary, #333);
  width: 40px;
  height: 40px;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.picker-controls button:active {
  background: var(--bg-active, #e0e0e0);
}

.picker-controls button svg {
  width: 16px;
  height: 16px;
}

.picker-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
}

.picker-range {
  font-size: 18px;
  font-weight: 600;
  min-width: 120px;
  text-align: center;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.year-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}

.year-btn {
  padding: 16px 8px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: var(--bg-page);
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  transition: all 0.2s;
}

.year-btn.active {
  background: var(--janote-income);
  border-color: var(--janote-income);
  color: var(--text-light);
}

.confirm-btn {
  width: 100%;
  padding: 12px;
  background: var(--text-primary);
  color: var(--text-light);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: opacity 0.2s;
}
</style>
