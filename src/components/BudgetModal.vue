<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { getCategoryIcon } from "../utils/categoryIcons";
import { useTransactionStore } from "../stores/transactionStore";
import type { EntryType } from "../types";

export interface Budget {
  id: string;
  name: string;
  type: EntryType;
  goal: number;
  categoryIds: string[];
  monthKey: string;
}

interface Props {
  show: boolean;
  editingBudget: Budget | null;
  transactionType: EntryType;
  monthKey: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  save: [budget: Budget];
  delete: [id: string];
}>();

const transactionStore = useTransactionStore();

const showCategoryDropdown = ref(false);
const modalForm = ref({
  name: "",
  goal: 0,
  selectedCategoryIds: [] as string[],
});

// Reset form whenever the modal opens
watch(
  () => props.show,
  (newShow) => {
    if (newShow) {
      if (props.editingBudget) {
        modalForm.value = {
          name: props.editingBudget.name,
          goal: props.editingBudget.goal,
          selectedCategoryIds: [...props.editingBudget.categoryIds],
        };
      } else {
        modalForm.value = { name: "", goal: 0, selectedCategoryIds: [] };
      }
      showCategoryDropdown.value = false;
    }
  },
);

const availableCategories = computed(() =>
  transactionStore.visibleCategories.filter(
    (c) => c.type === props.transactionType,
  ),
);

function getCategoryNameById(id: string): string {
  return (
    transactionStore.visibleCategories.find((c) => c.id === id)?.name ??
    "未知分類"
  );
}

function toggleCategory(id: string): void {
  const idx = modalForm.value.selectedCategoryIds.indexOf(id);
  if (idx === -1) {
    modalForm.value.selectedCategoryIds.push(id);
    if (modalForm.value.selectedCategoryIds.length === 1) {
      modalForm.value.name = getCategoryNameById(id);
    } else if (modalForm.value.selectedCategoryIds.length === 2) {
      modalForm.value.name = "";
    }
  } else {
    modalForm.value.selectedCategoryIds.splice(idx, 1);
    if (modalForm.value.selectedCategoryIds.length === 1) {
      modalForm.value.name = getCategoryNameById(
        modalForm.value.selectedCategoryIds[0]!,
      );
    }
  }
}

function handleSave(): void {
  const { name, goal, selectedCategoryIds } = modalForm.value;
  const resolvedName =
    selectedCategoryIds.length === 1
      ? getCategoryNameById(selectedCategoryIds[0]!)
      : name.trim();
  if (!resolvedName || goal <= 0 || selectedCategoryIds.length === 0) return;

  emit("save", {
    id: props.editingBudget?.id ?? `budget-${Date.now()}`,
    name: resolvedName,
    type: props.transactionType,
    goal,
    categoryIds: selectedCategoryIds,
    monthKey: props.monthKey,
  });
}

function handleDelete(): void {
  if (!props.editingBudget) return;
  emit("delete", props.editingBudget.id);
}

function handleClose(): void {
  showCategoryDropdown.value = false;
  emit("close");
}
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="modal-overlay" @click.self="handleClose">
      <div class="modal">
        <div class="modal-header">
          <h3>
            {{
              editingBudget
                ? transactionType === "EXPENSE"
                  ? "編輯支出預算"
                  : "編輯收入目標"
                : transactionType === "EXPENSE"
                  ? "新增支出預算"
                  : "新增收入目標"
            }}
          </h3>
          <button class="modal-close" @click="handleClose" aria-label="關閉">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <!-- Category multi-select -->
          <div class="modal-field">
            <label class="field-label">選擇分類（可多選）</label>
            <div class="category-select-wrap">
              <div
                class="category-select-trigger"
                @click="showCategoryDropdown = !showCategoryDropdown"
              >
                <div class="select-preview">
                  <span
                    v-if="modalForm.selectedCategoryIds.length === 0"
                    class="select-placeholder"
                    >請選擇分類</span
                  >
                  <div v-else class="select-pills">
                    <span
                      v-for="id in modalForm.selectedCategoryIds"
                      :key="id"
                      class="category-pill"
                      >{{ getCategoryNameById(id) }}</span
                    >
                  </div>
                </div>
                <svg
                  :class="['select-chevron', { rotated: showCategoryDropdown }]"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
              <div v-if="showCategoryDropdown" class="category-dropdown">
                <div
                  v-for="cat in availableCategories"
                  :key="cat.id"
                  class="dropdown-item"
                  :class="{
                    selected: modalForm.selectedCategoryIds.includes(cat.id),
                  }"
                  @click.stop="toggleCategory(cat.id)"
                >
                  <div
                    class="dropdown-check"
                    :class="{
                      checked: modalForm.selectedCategoryIds.includes(cat.id),
                    }"
                  >
                    <svg
                      v-if="modalForm.selectedCategoryIds.includes(cat.id)"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="3"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                  <div
                    class="dropdown-icon"
                    v-html="getCategoryIcon(cat.name)"
                  ></div>
                  <span class="dropdown-label">{{ cat.name }}</span>
                </div>
                <div
                  v-if="availableCategories.length === 0"
                  class="dropdown-empty"
                >
                  無可用的{{
                    transactionType === "EXPENSE" ? "支出" : "收入"
                  }}分類
                </div>
              </div>
            </div>
          </div>

          <!-- Budget name -->
          <div class="modal-field">
            <label class="field-label">預算名稱</label>
            <input
              v-model="modalForm.name"
              type="text"
              class="field-input"
              :placeholder="
                modalForm.selectedCategoryIds.length === 1
                  ? getCategoryNameById(modalForm.selectedCategoryIds[0]!)
                  : '例：雜支'
              "
              :disabled="modalForm.selectedCategoryIds.length === 1"
            />
            <span
              v-if="modalForm.selectedCategoryIds.length > 1"
              class="field-hint"
            >
              已選多個分類，請自訂群組名稱
            </span>
          </div>

          <!-- Budget goal -->
          <div class="modal-field">
            <label class="field-label">{{
              transactionType === "EXPENSE"
                ? "月預算目標 ($)"
                : "月收入目標 ($)"
            }}</label>
            <input
              v-model.number="modalForm.goal"
              type="number"
              class="field-input"
              placeholder="0"
              min="1"
            />
          </div>
        </div>

        <div class="modal-actions">
          <button
            v-if="editingBudget"
            class="modal-btn modal-delete-btn"
            @click="handleDelete"
          >
            刪除
          </button>
          <button class="modal-btn modal-cancel-btn" @click="handleClose">
            取消
          </button>
          <button class="modal-btn modal-save-btn" @click="handleSave">
            儲存
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
  padding: 0;
}

@media (min-width: 480px) {
  .modal-overlay {
    align-items: center;
  }
}

.modal {
  background: var(--bg-page);
  border-radius: 20px 20px 0 0;
  width: 100%;
  max-width: 480px;
  padding: 24px;
  box-shadow: 0 -4px 32px rgba(0, 0, 0, 0.15);
  max-height: 90vh;
  overflow-y: auto;
}

@media (min-width: 480px) {
  .modal {
    border-radius: 20px;
    width: 90%;
    max-height: 85vh;
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.modal-header h3 {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
}

.modal-close {
  width: 32px;
  height: 32px;
  border: none;
  background: #f0f0f0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-primary);
  transition: background 0.2s;
  flex-shrink: 0;
}

.modal-close:hover {
  background: #e0e0e0;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

.modal-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.field-hint {
  font-size: 12px;
  color: var(--text-disabled);
  margin-top: -2px;
}

.field-input {
  width: 100%;
  padding: 12px 14px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  font-size: 15px;
  font-family: inherit;
  color: var(--text-primary);
  background: var(--bg-page);
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.field-input:focus {
  border-color: var(--border-primary);
}

.field-input:disabled {
  background: #f5f5f5;
  color: var(--text-secondary);
  cursor: not-allowed;
}

.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.modal-btn {
  padding: 10px 20px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: 2px solid transparent;
  transition:
    opacity 0.2s,
    background 0.2s;
}

.modal-delete-btn {
  margin-right: auto;
  background: var(--janote-action-light, #fdd5d5);
  color: #b91c1c;
}

.modal-delete-btn:hover {
  background: var(--janote-action, #f87171);
  color: var(--text-light);
}

.modal-cancel-btn {
  background: #f0f0f0;
  color: var(--text-primary);
}

.modal-cancel-btn:hover {
  background: #e0e0e0;
}

.modal-save-btn {
  background: var(--text-primary);
  color: var(--text-light);
}

.modal-save-btn:hover {
  opacity: 0.8;
}

/* ── Modal transition ── */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal,
.modal-leave-active .modal {
  transition: transform 0.25s ease;
}

.modal-enter-from .modal {
  transform: translateY(40px);
}

.modal-leave-to .modal {
  transform: translateY(40px);
}

/* ── Category multi-select ── */
.category-select-wrap {
  position: relative;
}

.category-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  background: var(--bg-page);
  cursor: pointer;
  min-height: 48px;
  transition: border-color 0.2s;
}

.category-select-trigger:hover {
  border-color: var(--border-primary);
}

.select-preview {
  flex: 1;
  min-width: 0;
}

.select-placeholder {
  font-size: 15px;
  color: var(--text-disabled);
}

.select-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.category-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  background: #f0f0f0;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.select-chevron {
  flex-shrink: 0;
  color: var(--text-disabled);
  transition: transform 0.2s;
}

.select-chevron.rotated {
  transform: rotate(180deg);
}

.category-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: var(--bg-page);
  border: 2px solid var(--border-primary);
  border-radius: 12px;
  overflow: hidden;
  z-index: 200;
  max-height: 220px;
  overflow-y: auto;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.15s;
}

.dropdown-item:hover {
  background: #f9f9f9;
}

.dropdown-item.selected {
  background: #f5f5f5;
}

.dropdown-check {
  width: 20px;
  height: 20px;
  border: 2px solid #d0d0d0;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--bg-page);
  transition: all 0.15s;
  color: var(--text-primary);
}

.dropdown-check.checked {
  background: var(--text-primary);
  border-color: var(--text-primary);
  color: white;
}

.dropdown-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  border-radius: 8px;
  flex-shrink: 0;
}

.dropdown-icon :deep(svg) {
  width: 16px;
  height: 16px;
  stroke: var(--text-primary);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.dropdown-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.dropdown-empty {
  padding: 16px;
  text-align: center;
  color: var(--text-disabled);
  font-size: 14px;
}
</style>
