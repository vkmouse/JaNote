<!--
  Cloudflare Access（Service Token）驗證閘門。

  用法：把要保護的內容放進預設 slot，掛載時會自動檢查 localStorage 裡有沒有
  存憑證、帶著憑證打一次 /api/auth/login：
    - 200 → 顯示 slot 內容，並發出 `authenticated` 事件（父層可以藉此知道
      「現在才可以開始打其他需要登入的 API」，例如觸發第一次同步）
    - 沒存值，或收到非 200（403 Service Token 無效、401 email 沒登記在
      SERVICE_IDENTITY_MAP、網路錯誤、伺服器錯誤等）→ 顯示輸入畫面 +
      同一句錯誤訊息，不特別區分失敗原因（因為未來已經沒有導去 CF Access
      登入頁這件事，唯一能做的動作就是「重新輸入一次」）

  刻意不引入專案共用樣式，所有樣式都寫在這個檔案的 <style scoped> 裡，方便
  未來其他站需要同樣的驗證流程時可以直接複製這個檔案（連同 ../services/auth.ts）。
-->
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { getStoredCredentials, storeCredentials, login } from "../services/auth";

const emit = defineEmits<{ authenticated: [] }>();

/** 是否已經通過驗證、可以顯示 slot 內容。 */
const authenticated = ref(false);
/** 掛載時的第一次驗證是否還在進行中（跟送出表單後的 submitting 分開，避免畫面互相干擾）。 */
const checking = ref(true);
const errorMessage = ref("");

const clientIdInput = ref("");
const clientSecretInput = ref("");
const submitting = ref(false);

async function check() {
  const stored = getStoredCredentials();
  if (!stored) {
    checking.value = false;
    return;
  }

  const ok = await login();
  checking.value = false;

  if (ok) {
    authenticated.value = true;
    emit("authenticated");
  } else {
    errorMessage.value = "驗證失敗，請確認 Client ID / Secret 是否正確";
  }
}

async function handleSubmit() {
  const clientId = clientIdInput.value.trim();
  const clientSecret = clientSecretInput.value.trim();
  if (!clientId || !clientSecret) {
    return;
  }

  submitting.value = true;
  errorMessage.value = "";

  // 先不寫 localStorage，直接拿使用者剛輸入的值去試登入；
  // 確認 200（成功）才真的存進 localStorage，避免把還沒驗證過、
  // 可能是打錯的憑證提早留在瀏覽器裡。
  const credentials = { clientId, clientSecret };
  const ok = await login(credentials);

  if (ok) {
    storeCredentials(credentials);
    authenticated.value = true;
    emit("authenticated");
  } else {
    errorMessage.value = "驗證失敗，請確認 Client ID / Secret 是否正確";
  }
  submitting.value = false;
}

onMounted(() => {
  check();
});
</script>

<template>
  <slot v-if="authenticated" />

  <div v-else class="access-gate">
    <div class="access-gate__box">
      <template v-if="checking">
        <p class="access-gate__text">驗證中…</p>
      </template>

      <template v-else>
        <h1 class="access-gate__title">請輸入存取憑證</h1>
        <label class="access-gate__field">
          <span>Client ID</span>
          <input
            v-model="clientIdInput"
            type="text"
            autocomplete="off"
            spellcheck="false"
            :disabled="submitting"
            @keyup.enter="handleSubmit"
          />
        </label>
        <label class="access-gate__field">
          <span>Client Secret</span>
          <input
            v-model="clientSecretInput"
            type="password"
            autocomplete="off"
            spellcheck="false"
            :disabled="submitting"
            @keyup.enter="handleSubmit"
          />
        </label>
        <p v-if="errorMessage" class="access-gate__error">{{ errorMessage }}</p>
        <button
          class="access-gate__button"
          type="button"
          :disabled="submitting || !clientIdInput.trim() || !clientSecretInput.trim()"
          @click="handleSubmit"
        >
          {{ submitting ? "驗證中…" : "送出" }}
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.access-gate {
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #111827;
  color: #f3f4f6;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  box-sizing: border-box;
  padding: 24px;
}

.access-gate__box {
  width: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.access-gate__title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.access-gate__text {
  font-size: 14px;
  color: #9ca3af;
  margin: 0;
}

.access-gate__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: #d1d5db;
}

.access-gate__field input {
  padding: 9px 10px;
  border-radius: 6px;
  border: 1px solid #374151;
  background: #1f2937;
  color: #f3f4f6;
  font-size: 14px;
  box-sizing: border-box;
}

.access-gate__field input:focus {
  outline: none;
  border-color: #2563eb;
}

.access-gate__field input:disabled {
  opacity: 0.6;
}

.access-gate__error {
  margin: 0;
  font-size: 13px;
  color: #f87171;
}

.access-gate__button {
  margin-top: 4px;
  padding: 10px;
  border-radius: 6px;
  border: none;
  background: #2563eb;
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.access-gate__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
