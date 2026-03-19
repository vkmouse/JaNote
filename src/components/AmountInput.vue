<script setup lang="ts">
import type { EntryType } from "../types";

defineProps<{
  icon: string;
  formattedAmount: string;
  type: EntryType;
  modelValue: string;
  placeholder: string;
}>();

defineEmits<{
  "update:modelValue": [value: string];
}>();
</script>

<template>
  <div class="input-section">
    <div class="input-group">
      <label class="label">
        <div class="category-icon-display" v-html="icon"></div>
        <span
          :class="[
            'amount-display',
            {
              'amount-expense': type === 'EXPENSE',
              'amount-income': type === 'INCOME',
            },
          ]"
          >${{ formattedAmount }}</span
        >
      </label>
      <input
        :value="modelValue"
        @input="
          $emit('update:modelValue', ($event.target as HTMLInputElement).value)
        "
        type="text"
        :placeholder="placeholder"
        class="notes-input"
      />
    </div>
  </div>
</template>

<style scoped>
.input-section {
  flex-shrink: 0;
  padding: 16px;
  border-bottom: 2px solid var(--border-primary);
}

.input-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.label {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  flex: 0 0 auto;
  min-width: 150px;
}

.category-icon-display {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.category-icon-display :deep(svg) {
  width: 24px;
  height: 24px;
  color: #333;
}

.amount-display {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

.notes-input {
  flex: 1;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  padding: 8px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}

.notes-input:focus {
  border-color: var(--border-primary);
}
</style>
