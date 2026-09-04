import "./assets/main.css";

import { createApp } from "vue";
import { createPinia } from "pinia";
import router from "./router";
import App from "./App.vue";
import { initTheme } from "./utils/theme";

// 在建立 / 掛載 app 之前先套用已存的主題偏好，避免畫面先閃白色再變深色
initTheme();

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");
