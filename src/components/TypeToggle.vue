<script setup lang="ts">
import type { EntryType } from "../types";

defineProps<{ modelValue: EntryType }>();
defineEmits<{ "update:modelValue": [value: EntryType] }>();
</script>

<template>
  <div class="type-toggle">
    <button
      :class="[
        'toggle-btn',
        {
          active: modelValue === 'EXPENSE',
          'expense-active': modelValue === 'EXPENSE',
        },
      ]"
      @click="$emit('update:modelValue', 'EXPENSE')"
    >
      支出
    </button>
    <button
      :class="[
        'toggle-btn',
        {
          active: modelValue === 'INCOME',
          'income-active': modelValue === 'INCOME',
        },
      ]"
      @click="$emit('update:modelValue', 'INCOME')"
    >
      收入
    </button>
  </div>
</template>

<style scoped>
.type-toggle {
  display: flex;
  gap: 2px;
  border: 2px solid var(--border-primary);
  border-radius: 20px;
  padding: 2px;
  background: var(--bg-page);
}

.toggle-btn {
  padding: 4px 14px;
  border: none;
  border-radius: 16px;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 38px;
}

.toggle-btn.expense-active {
  background: var(--janote-expense);
  color: var(--text-primary);
}

.toggle-btn.income-active {
  background: var(--janote-income);
  color: var(--text-light);
}
</style>
