<template>
  <div class="calc-section">
    <div class="calc-grid">
      <!-- Row 1 -->
      <button
        v-for="key in calculatorKeys.slice(0, 3)"
        :key="key"
        class="calc-btn number-btn"
        @click="handleCalcKey(key)"
      >
        {{ key }}
      </button>
      <button
        class="calc-btn function-btn"
        :class="{ 'operator-active': pendingOperator === '÷' }"
        @click="handleCalcKey('÷')"
      >
        ÷
      </button>
      <button class="calc-btn function-btn" @click="handleCalcKey('AC')">
        AC
      </button>

      <!-- Row 2 -->
      <button
        v-for="key in calculatorKeys.slice(4, 7)"
        :key="key"
        class="calc-btn number-btn"
        @click="handleCalcKey(key)"
      >
        {{ key }}
      </button>
      <button
        class="calc-btn function-btn"
        :class="{ 'operator-active': pendingOperator === '×' }"
        @click="handleCalcKey('×')"
      >
        ×
      </button>
      <button class="calc-btn function-btn" @click="handleCalcKey('←')">
        ←
      </button>

      <!-- Row 3 -->
      <button
        v-for="key in calculatorKeys.slice(8, 11)"
        :key="key"
        class="calc-btn number-btn"
        @click="handleCalcKey(key)"
      >
        {{ key }}
      </button>
      <button
        class="calc-btn function-btn"
        :class="{ 'operator-active': pendingOperator === '+' }"
        @click="handleCalcKey('+')"
      >
        +
      </button>
      <button
        class="calc-btn confirm-btn"
        @click="handleConfirmClick"
        :disabled="!confirmEnabled"
      >
        {{ confirmLabel }}
      </button>

      <!-- Row 4 -->
      <button
        v-for="key in calculatorKeys.slice(12, 15)"
        :key="key"
        class="calc-btn number-btn"
        @click="handleCalcKey(key)"
      >
        {{ key }}
      </button>
      <button
        class="calc-btn function-btn"
        :class="{ 'operator-active': pendingOperator === '-' }"
        @click="handleCalcKey('-')"
      >
        −
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

const props = withDefaults(
  defineProps<{ modelValue: string; canConfirm?: boolean }>(),
  {
    canConfirm: false,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "confirm"): void;
}>();

const calculatorKeys = [
  "7",
  "8",
  "9",
  "÷",
  "4",
  "5",
  "6",
  "×",
  "1",
  "2",
  "3",
  "+",
  "00",
  "0",
  ".",
  "-",
];

// 待運算的運算符（pending 狀態）
const pendingOperator = ref<string | null>(null);
// 進入 pending 前的第一個運算元快照
const firstOperand = ref<string>("");
// 是否已開始輸入第二個運算元（pending 狀態下按下第一個按鍵才設為 true）
const hasSecondInput = ref(false);

const amount = computed({
  get: () => props.modelValue,
  set: (value: string) => emit("update:modelValue", value),
});

// 確定按鈕文字：pending 狀態下顯示 =，否則顯示確定
const confirmLabel = computed(() => (pendingOperator.value ? "=" : "確定"));

// 確定按鈕 enable 條件：有 pending 狀態時也要可點（用於計算或還原）
const confirmEnabled = computed(
  () => props.canConfirm || !!pendingOperator.value,
);

// 計算兩個運算元的結果，回傳數值或 null（無效時）
const calculate = (a: string, op: string, b: string): number | null => {
  const numA = parseFloat(a);
  const numB = parseFloat(b);
  if (Number.isNaN(numA) || Number.isNaN(numB)) return null;
  if (op === "+") return numA + numB;
  if (op === "-") return numA - numB;
  if (op === "×") return numA * numB;
  if (op === "÷") {
    if (numB === 0) return null;
    return numA / numB;
  }
  return null;
};

// 進入 pending 狀態：儲存第一個運算元，保持 amount 顯示（不清空）
// value 參數用於直接指定 firstOperand，避免依賴 props.modelValue 尚未同步的問題
const enterPendingState = (op: string, value?: string) => {
  firstOperand.value = value !== undefined ? value : amount.value;
  pendingOperator.value = op;
  hasSecondInput.value = false;
};

// 清除 pending 狀態
const clearPending = () => {
  pendingOperator.value = null;
  firstOperand.value = "";
  hasSecondInput.value = false;
};

// 確定 / = 按鈕點擊處理
const handleConfirmClick = () => {
  if (!pendingOperator.value) {
    // 非 pending 狀態：直接存檔
    emit("confirm");
    return;
  }

  if (!hasSecondInput.value) {
    // pending 狀態但尚未輸入第二個數字：清除 pending（amount 已顯示 firstOperand）
    clearPending();
    return;
  }

  // pending 狀態且有第二個數字：計算結果
  const result = calculate(firstOperand.value, pendingOperator.value, amount.value);
  clearPending();
  if (result !== null && !Number.isNaN(result)) {
    amount.value = String(Math.round(result * 100) / 100);
  }
  // 計算完成後不自動存檔，讓使用者確認結果再按確定
};

const handleCalcKey = (key: string) => {
  if (key === "AC") {
    // 全部清除，包含 pending 狀態
    amount.value = "";
    clearPending();
    return;
  }

  if (key === "←") {
    if (pendingOperator.value) {
      // pending 狀態下按退格：取消 pending，還原第一個運算元
      amount.value = firstOperand.value;
      clearPending();
    } else {
      amount.value = amount.value.slice(0, -1);
    }
    return;
  }

  // 運算符按鈕處理
  if (key === "+" || key === "-" || key === "×" || key === "÷") {
    if (pendingOperator.value) {
      if (hasSecondInput.value) {
        // 已有 pending 且有第二個數字：先計算結果，再進入新 pending
        const result = calculate(firstOperand.value, pendingOperator.value, amount.value);
        if (result !== null && !Number.isNaN(result)) {
          const resultStr = String(Math.round(result * 100) / 100);
          clearPending();
          amount.value = resultStr;
          // 直接傳入 resultStr，不依賴 props.modelValue 同步更新
          enterPendingState(key, resultStr);
        }
      } else {
        // 已有 pending 但尚未輸入第二個數字：直接替換運算符
        pendingOperator.value = key;
      }
    } else {
      // 非 pending 狀態：進入 pending
      if (amount.value) {
        enterPendingState(key);
      } else if (key === "-") {
        // 空白狀態按 -：以 0 為第一運算元，方便輸入負數
        firstOperand.value = "0";
        pendingOperator.value = "-";
        hasSecondInput.value = false;
      }
    }
    return;
  }

  // 小數點處理
  if (key === ".") {
    if (pendingOperator.value && !hasSecondInput.value) {
      // 開始輸入第二個運算元，以 0. 起始
      amount.value = "0.";
      hasSecondInput.value = true;
      return;
    }
    if (amount.value.includes(".")) return;
    amount.value += key;
    return;
  }

  // 數字按鈕（含 00）
  if (pendingOperator.value && !hasSecondInput.value) {
    // 第一個按鍵：替換顯示（不 append），開始輸入第二運算元
    // 00 開頭時視為 0，避免 "005" 這類非預期輸入
    amount.value = key === "00" ? "0" : key;
    hasSecondInput.value = true;
    return;
  }

  amount.value += key;
};
</script>

<style scoped>
.calc-section {
  background: transparent;
}

.calc-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.calc-btn {
  padding: 18px;
  border: 2px solid var(--border-primary);
  border-radius: 10px;
  cursor: pointer;
  font-size: 18px;
  font-weight: 600;
  transition: all 0.15s;
  color: var(--text-primary);
  background: transparent;
}

.calc-btn:active {
  transform: scale(0.95);
}

.calc-btn.number-btn {
  background: #ffffff;
}

.calc-btn.function-btn {
  background: var(--janote-income);
  color: var(--text-light);
  font-weight: 700;
}

.calc-btn.function-btn.operator-active {
  background: var(--janote-action);
  box-shadow: 0 2px 8px rgba(248, 113, 113, 0.3);
}

.calc-btn.confirm-btn {
  background: var(--janote-action);
  color: var(--text-light);
  font-weight: 700;
  font-size: 16px;
  grid-row: span 2;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(248, 113, 113, 0.3);
  border: 2px solid var(--border-primary);
}

.calc-btn.confirm-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.calc-btn.confirm-btn:disabled {
  background: #e9ecef;
  color: #adb5bd;
  cursor: not-allowed;
  box-shadow: none;
}
</style>
