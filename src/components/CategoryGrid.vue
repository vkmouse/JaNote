<script setup lang="ts">
import type { Category } from "../types";
import { getCategoryIcon } from "../utils/categoryIcons";

const props = defineProps<{
  categories: Category[];
  modelValue: string | string[];
  multiple?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string | string[]];
  select: [category: Category, selected: boolean];
}>();

function isSelected(id: string): boolean {
  if (props.multiple) {
    return (props.modelValue as string[]).includes(id);
  }
  return props.modelValue === id;
}

function handleClick(category: Category): void {
  if (props.multiple) {
    const current = props.modelValue as string[];
    const idx = current.indexOf(category.id);
    const selected = idx === -1;
    const next = selected
      ? [...current, category.id]
      : current.filter((id) => id !== category.id);
    emit("update:modelValue", next);
    emit("select", category, selected);
  } else {
    emit("update:modelValue", category.id);
    emit("select", category, true);
  }
}
</script>

<template>
  <div class="categories-grid">
    <button
      v-for="category in categories"
      :key="category.id"
      :class="['category-item', { selected: isSelected(category.id) }]"
      @click="handleClick(category)"
    >
      <div
        class="category-icon-wrapper"
        v-html="getCategoryIcon(category.name)"
      ></div>
      <span class="category-label">{{ category.name }}</span>
    </button>
  </div>
</template>

<style scoped>
.categories-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.category-item {
  padding: 6px 4px;
  border: 2px solid transparent;
  border-radius: 12px;
  background: transparent;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition:
    background 0.2s,
    border-color 0.2s;
}

.category-item.selected {
  background: #f0f0f0;
  border-color: var(--border-primary);
}

.category-item.selected .category-icon-wrapper {
  position: relative;
}

.category-item.selected .category-icon-wrapper::after {
  content: "";
  position: absolute;
  bottom: 0;
  right: 0;
  width: 8px;
  height: 8px;
  background: var(--border-primary);
  border-radius: 50%;
  border: 1.5px solid var(--bg-page);
}

.category-icon-wrapper {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.category-icon-wrapper :deep(svg) {
  width: 24px;
  height: 24px;
  color: #333;
}

.category-label {
  font-size: 12px;
  font-weight: 500;
  text-align: center;
  word-break: break-word;
  color: var(--text-primary);
  line-height: 1.2;
}
</style>
