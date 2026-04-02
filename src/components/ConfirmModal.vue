<script setup lang="ts">
interface Props {
  show: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "danger";
}

withDefaults(defineProps<Props>(), {
  title: "確認",
  confirmText: "確認",
  cancelText: "取消",
  variant: "default",
});

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="modal-overlay" @click="emit('cancel')">
      <div class="modal-container" @click.stop>
        <h3 class="modal-title">{{ title }}</h3>
        <div class="modal-body">
          <slot>
            <p v-if="message">{{ message }}</p>
          </slot>
        </div>
        <div class="modal-footer">
          <button v-if="cancelText" class="btn-cancel" @click="emit('cancel')">
            {{ cancelText }}
          </button>
          <button
            :class="['btn-confirm', { 'btn-danger': variant === 'danger' }]"
            @click="emit('confirm')"
          >
            {{ confirmText }}
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
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background: var(--bg-page);
  border-radius: 16px;
  padding: 24px;
  min-width: 280px;
  width: 85%;
  max-width: 380px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.modal-title {
  margin: 0 0 10px;
  text-align: center;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-body {
  margin-bottom: 20px;
}

.modal-body p {
  margin: 0;
  text-align: center;
  color: var(--text-secondary, #6b7280);
  font-size: 14px;
  line-height: 1.6;
}

.modal-footer {
  display: flex;
  gap: 10px;
}

.btn-cancel,
.btn-confirm {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-cancel {
  background: var(--bg-hover, #f3f4f6);
  color: var(--text-secondary, #6b7280);
  border: 1px solid var(--border-primary, #e5e7eb);
}

.btn-confirm {
  background: var(--text-primary);
  color: var(--text-light);
}

.btn-danger {
  background: #ef4444;
  color: #fff;
}

/* Modal transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
