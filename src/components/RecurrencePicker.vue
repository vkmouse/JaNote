<template>
  <div
    v-if="open"
    class="rp-overlay"
    @click="close"
  >
    <div class="rp-modal" @click.stop>
      <div class="rp-header">
        <div class="rp-type-toggle">
          <button
            :class="['rp-type-btn', { active: localType === 'MONTHLY' }]"
            @click="switchType('MONTHLY')"
          >
            每月
          </button>
          <button
            :class="['rp-type-btn', { active: localType === 'WEEKLY' }]"
            @click="switchType('WEEKLY')"
          >
            每週
          </button>
        </div>
      </div>

      <!-- Monthly grid: 31 days -->
      <div v-if="localType === 'MONTHLY'" class="rp-monthly-grid">
        <button
          v-for="d in 31"
          :key="d"
          :class="['rp-day-btn', { selected: localDay === d }]"
          @click="localDay = d"
        >
          {{ d }}
        </button>
      </div>

      <!-- Weekly: weekday labels row + buttons -->
      <div v-else class="rp-weekly-section">
        <div class="rp-weekday-labels">
          <div v-for="label in WEEK_DAY_LABELS" :key="label" class="rp-weekday-label">{{ label }}</div>
        </div>
        <div class="rp-weekly-grid">
          <button
            v-for="(_, i) in WEEK_DAY_LABELS"
            :key="i"
            :class="['rp-day-btn', { selected: localDay === i }]"
            @click="localDay = i"
          >
            {{ i + 1 }}
          </button>
        </div>
      </div>

      <div class="rp-footer">
        <button class="rp-confirm-btn" @click="confirm">確認</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { WEEK_DAY_LABELS } from "../utils/recurrence";

const props = defineProps<{
  open: boolean;
  recurrenceType: "MONTHLY" | "WEEKLY";
  recurrenceDays: number[];
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  "update:recurrenceType": [value: "MONTHLY" | "WEEKLY"];
  "update:recurrenceDays": [value: number[]];
}>();

const localType = ref<"MONTHLY" | "WEEKLY">(props.recurrenceType);
const localDay = ref<number>(props.recurrenceDays[0] ?? 1);

watch(
  () => props.open,
  (val) => {
    if (val) {
      localType.value = props.recurrenceType;
      localDay.value = props.recurrenceDays[0] ?? (props.recurrenceType === "MONTHLY" ? 1 : 0);
    }
  },
);

function switchType(type: "MONTHLY" | "WEEKLY") {
  localType.value = type;
  localDay.value = type === "MONTHLY" ? 1 : 0;
}

function confirm() {
  emit("update:recurrenceType", localType.value);
  emit("update:recurrenceDays", [localDay.value]);
  emit("update:open", false);
}

function close() {
  emit("update:open", false);
}
</script>

<style scoped>
.rp-overlay {
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

.rp-modal {
  background: var(--bg-page);
  border-radius: 16px;
  padding: 20px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.rp-header {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.rp-type-toggle {
  display: flex;
  gap: 2px;
  border: 2px solid var(--border-primary);
  border-radius: 20px;
  padding: 2px;
}

.rp-type-btn {
  padding: 6px 24px;
  border: none;
  border-radius: 16px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  background: transparent;
  color: var(--text-primary);
  transition:
    background 0.15s ease,
    color 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.rp-type-btn.active {
  background: var(--border-primary);
  color: var(--bg-page);
}

/* Monthly: 7 columns × 5 rows */
.rp-monthly-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 16px;
}

/* Weekly */
.rp-weekly-section {
  margin-bottom: 16px;
}

.rp-weekday-labels {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 8px;
}

.rp-weekday-label {
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  padding: 4px 0;
}

.rp-weekly-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.rp-day-btn {
  aspect-ratio: 1;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  background: transparent;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background 0.12s ease,
    color 0.12s ease;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
}

.rp-day-btn:active {
  background: var(--janote-action-light);
}

.rp-day-btn.selected {
  background: var(--janote-action);
  color: var(--text-light);
  font-weight: 700;
}

.rp-footer {
  display: flex;
  gap: 8px;
}

.rp-confirm-btn {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  background: var(--text-primary);
  color: var(--bg-page);
  transition: opacity 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.rp-confirm-btn:active {
  opacity: 0.75;
}
</style>
