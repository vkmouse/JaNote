<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: any;
    leftLabel?: string;
    rightLabel?: string;
    leftValue?: any;
    rightValue?: any;
  }>(),
  {
    leftLabel: "支出",
    rightLabel: "收入",
    leftValue: "EXPENSE",
    rightValue: "INCOME",
  },
);

defineEmits<{ "update:modelValue": [value: any] }>();
</script>

<template>
  <div class="state-toggle">
    <button
      :class="[
        'toggle-btn',
        {
          active: modelValue === leftValue,
        },
      ]"
      @click="$emit('update:modelValue', leftValue)"
    >
      {{ leftLabel }}
    </button>
    <button
      :class="[
        'toggle-btn',
        {
          active: modelValue === rightValue,
        },
      ]"
      @click="$emit('update:modelValue', rightValue)"
    >
      {{ rightLabel }}
    </button>
  </div>
</template>

<style scoped>
.state-toggle {
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

.toggle-btn:first-child.active {
  background: var(--janote-expense);
  color: var(--text-primary);
}

.toggle-btn:last-child.active {
  background: var(--janote-income);
  color: var(--text-light);
}
</style>
