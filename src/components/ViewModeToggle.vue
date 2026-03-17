<script setup lang="ts">
type ViewMode = "monthly" | "yearly" | "custom";

defineProps<{ modelValue: ViewMode }>();
defineEmits<{ "update:modelValue": [value: ViewMode] }>();
</script>

<template>
  <div class="view-mode-toggle">
    <button
      :class="['mode-btn', { active: modelValue === 'monthly' }]"
      @click="$emit('update:modelValue', 'monthly')"
    >
      月
    </button>
    <button
      :class="['mode-btn', { active: modelValue === 'yearly' }]"
      @click="$emit('update:modelValue', 'yearly')"
    >
      年
    </button>
    <button
      :class="['mode-btn', { active: modelValue === 'custom' }]"
      @click="$emit('update:modelValue', 'custom')"
    >
      自訂
    </button>
  </div>
</template>

<style scoped>
.view-mode-toggle {
  display: flex;
  gap: 2px;
  border: 2px solid var(--border-primary);
  border-radius: 20px;
  padding: 2px;
  background: var(--bg-page);
}

.mode-btn {
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

.mode-btn.active {
  background: var(--text-primary);
  color: var(--text-light);
}
</style>
