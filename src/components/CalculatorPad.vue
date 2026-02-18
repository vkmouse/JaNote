<template>
  <div class="calc-section">
    <div class="calc-grid">
      <!-- Row 1 -->
      <button v-for="key in calculatorKeys.slice(0, 3)" :key="key" class="calc-btn number-btn" @click="handleCalcKey(key)">
        {{ key }}
      </button>
      <button class="calc-btn function-btn" @click="handleCalcKey('÷')">÷</button>
      <button class="calc-btn function-btn" @click="handleCalcKey('AC')">AC</button>

      <!-- Row 2 -->
      <button v-for="key in calculatorKeys.slice(4, 7)" :key="key" class="calc-btn number-btn" @click="handleCalcKey(key)">
        {{ key }}
      </button>
      <button class="calc-btn function-btn" @click="handleCalcKey('×')">×</button>
      <button class="calc-btn function-btn" @click="handleCalcKey('←')">←</button>

      <!-- Row 3 -->
      <button v-for="key in calculatorKeys.slice(8, 11)" :key="key" class="calc-btn number-btn" @click="handleCalcKey(key)">
        {{ key }}
      </button>
      <button class="calc-btn function-btn" @click="handleCalcKey('+')">+</button>
      <button class="calc-btn confirm-btn" @click="emit('confirm')" :disabled="!canConfirm">確定</button>

      <!-- Row 4 -->
      <button v-for="key in calculatorKeys.slice(12, 15)" :key="key" class="calc-btn number-btn" @click="handleCalcKey(key)">
        {{ key }}
      </button>
      <button class="calc-btn function-btn" @click="handleCalcKey('=')">&#61;</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ modelValue: string; canConfirm?: boolean }>(), {
  canConfirm: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'confirm'): void
}>()

const calculatorKeys = [
  '7', '8', '9', '÷',
  '4', '5', '6', '×',
  '1', '2', '3', '+',
  '00', '0', '.', '=',
]

const amount = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value)
})

const handleCalcKey = (key: string) => {
  if (key === 'AC') {
    amount.value = ''
    return
  }

  if (key === '←') {
    amount.value = amount.value.slice(0, -1)
    return
  }

  if (key === '=') {
    try {
      const evaluateExpression = (input: string): number | null => {
        if (!input) return null
        const expr = input.replace(/÷/g, '/').replace(/×/g, '*')

        const tokens: string[] = []
        let i = 0
        while (i < expr.length) {
          const ch = expr[i]
          if (!ch) break
          if (ch === ' ') { i++; continue }
          if (/[0-9.]/.test(ch)) {
            let num = ch
            i++
            while (i < expr.length) {
              const nextCh = expr[i]
              if (!nextCh || !/[0-9.]/.test(nextCh)) break
              num += nextCh
              i++
            }
            if ((num.match(/\./g) || []).length > 1) return null
            tokens.push(num)
            continue
          }
          if (/[+\-*/]/.test(ch)) {
            tokens.push(ch)
            i++
            continue
          }
          return null
        }

        if (tokens.length === 0) return null

        const prec: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 }
        const output: string[] = []
        const ops: string[] = []

        for (let t of tokens) {
          if (/^[0-9.]+$/.test(t)) {
            output.push(t)
          } else if (/^[+\-*/]$/.test(t)) {
            while (ops.length > 0) {
              const topOp = ops[ops.length - 1]
              if (!topOp || (prec[topOp] ?? 0) < (prec[t] ?? 0)) break
              output.push(ops.pop()!)
            }
            ops.push(t)
          } else {
            return null
          }
        }
        while (ops.length > 0) output.push(ops.pop()!)

        const stack: number[] = []
        for (let token of output) {
          if (/^[0-9.]+$/.test(token)) {
            stack.push(parseFloat(token))
          } else {
            if (stack.length < 2) return null
            const b = stack.pop()!
            const a = stack.pop()!
            let res: number
            if (token === '+') res = a + b
            else if (token === '-') res = a - b
            else if (token === '*') res = a * b
            else if (token === '/') {
              if (b === 0) return null
              res = a / b
            } else return null
            stack.push(res)
          }
        }
        if (stack.length !== 1) return null
        return stack[0] ?? null
      }

      const result = evaluateExpression(amount.value)
      if (result === null || Number.isNaN(result)) {
        // Invalid expression, ignore
      } else {
        amount.value = String(Math.round(result * 100) / 100)
      }
    } catch {
      // Invalid expression or other error, ignore
    }
    return
  }

  if (key === '.' && amount.value.includes('.')) {
    return
  }

  amount.value += key
}
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

.calc-btn.number-btn:hover {
  background: #f8f9fa;
}

.calc-btn.function-btn {
  background: #e9ecef;
  color: var(--text-primary);
  font-weight: 700;
}

.calc-btn.function-btn:hover {
  background: #dee2e6;
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
  border: 2px solid var(--janote-action);
}

.calc-btn.confirm-btn:hover:not(:disabled) {
  background: #ef4444;
  box-shadow: 0 4px 12px rgba(248, 113, 113, 0.4);
}

.calc-btn.confirm-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.calc-btn.confirm-btn:disabled {
  background: #e9ecef;
  color: #adb5bd;
  cursor: not-allowed;
  box-shadow: none;
  border: 2px solid #e9ecef;
}
</style>
