<template>
  <div v-if="open" class="month-picker-overlay" @click="close">
    <div class="month-picker" @click.stop>
      <h3>選擇年月</h3>
      <div class="picker-controls">
        <button @click="emit('update:year', year - 1)">
          <span v-html="iconChevronLeft" class="picker-arrow"></span>
        </button>
        <span class="picker-year">{{ year }}</span>
        <button @click="emit('update:year', year + 1)">
          <span v-html="iconChevronRight" class="picker-arrow"></span>
        </button>
      </div>
      <div class="month-grid">
        <button
          v-for="monthOption in 12"
          :key="monthOption"
          :class="['month-btn', { active: monthOption === month }]"
          @click="emit('update:month', monthOption)"
        >
          {{ monthOption }}月
        </button>
      </div>
      <button class="confirm-btn" @click="confirm">確認</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { iconChevronLeft, iconChevronRight } from "../utils/icons";

const props = defineProps<{ open: boolean; year: number; month: number }>();
const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "update:year", value: number): void;
  (e: "update:month", value: number): void;
  (e: "confirm"): void;
}>();

const close = () => emit("update:open", false);
const confirm = () => {
  emit("confirm");
  close();
};
</script>

<style scoped>
.month-picker-overlay {
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

.month-picker {
  background: var(--bg-page);
  border-radius: 16px;
  padding: 24px;
  min-width: 320px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.month-picker h3 {
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

.picker-arrow :deep(svg) {
  width: 20px;
  height: 20px;
  display: block;
}

.picker-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
}

.picker-year {
  font-size: 20px;
  font-weight: 600;
  min-width: 80px;
  text-align: center;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.month-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}

.month-btn {
  padding: 12px 8px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: var(--bg-page);
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  transition: all 0.2s;
}

.month-btn.active {
  background: var(--janote-income);
  border-color: var(--janote-income);
  color: var(--text-light);
  font-weight: 600;
}

.confirm-btn {
  width: 100%;
  padding: 12px;
  background: var(--text-primary);
  color: var(--text-light);
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
</style>
