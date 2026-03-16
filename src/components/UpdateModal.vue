<script setup lang="ts">
import { ref } from "vue";

interface Props {
  show: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  update: [];
  close: [];
}>();

const handleUpdate = () => {
  emit("update");
};

const handleClose = () => {
  emit("close");
};
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="modal-overlay" @click="handleClose">
      <div class="modal-container" @click.stop>
        <div class="modal-header">
          <h3>🎉 新版本可用</h3>
        </div>
        <div class="modal-body">
          <p>我們已經準備好新版本，包含功能改進和錯誤修正。</p>
          <p>是否立即更新？</p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="handleClose">稍後再說</button>
          <button class="btn-primary" @click="handleUpdate">立即更新</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.modal-container {
  background: white;
  border-radius: 12px;
  max-width: 400px;
  width: 90%;
  box-shadow:
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #111827;
}

.modal-body {
  padding: 24px;
}

.modal-body p {
  margin: 0 0 12px 0;
  color: #4b5563;
  line-height: 1.6;
}

.modal-body p:last-child {
  margin-bottom: 0;
  font-weight: 500;
  color: #111827;
}

.modal-footer {
  padding: 16px 24px;
  background-color: #f9fafb;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-secondary,
.btn-primary {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  outline: none;
}

.btn-secondary {
  background-color: white;
  color: #6b7280;
  border: 1px solid #d1d5db;
}

.btn-primary {
  background-color: #3b82f6;
  color: white;
}

.btn-primary:active {
  transform: scale(0.98);
}

/* Modal transition animation */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95) translateY(-20px);
}
</style>
