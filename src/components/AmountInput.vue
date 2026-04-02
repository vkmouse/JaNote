<script setup lang="ts">
import type { EntryType } from "../types";
import CategoryIcon from "./CategoryIcon.vue";

defineProps<{
  categoryName: string;
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
        <CategoryIcon :category-name="categoryName" />
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
  padding: 4px 16px;
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

.amount-display {
  height: 40px;
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

.notes-input {
  flex: 1;
  border: 2px solid var(--text-disabled);
  border-radius: 10px;
  padding: 8px;
  font-size: 15px;
  outline: none;
  transition: border-color 0.2s;
}

.notes-input:focus {
  border-color: var(--border-primary);
}
</style>
