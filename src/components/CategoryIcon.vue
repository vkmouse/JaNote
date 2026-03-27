<script lang="ts">
export const categoryColorMap: Record<string, string> = {
  // 支出
  早餐: "#F7DC6F",
  午餐: "#FFA07A",
  晚餐: "#FF6B6B",
  飲品: "#4ECDC4",
  點心: "#F8B88B",
  酒類: "#BB8FCE",
  交通: "#45B7D1",
  購物: "#F1948A",
  娛樂: "#D7BDE2",
  日用品: "#98D8C8",
  房租: "#85C1E2",
  醫療: "#82E0AA",
  社交: "#FAD7A0",
  禮物: "#F9C0C0",
  數位: "#AED6F1",
  貓咪: "#A3E4D7",
  旅行: "#C8B8E8",
  其他: "#CCD1D1",
  // 收入
  薪水: "#A8D8B9",
  獎金: "#F5CBA7",
  交易: "#FECE85",
  投資: "#80DEEA",
  股息: "#B0C4DE",
  利息: "#D4B8E0",
};

export function getCategoryColor(categoryName: string): string {
  return categoryColorMap[categoryName] ?? "#CCD1D1";
}
</script>

<script setup lang="ts">
import { computed } from "vue";
import type { EntryType } from "../types";
import {
  iconBowlSteam,
  iconBread,
  iconBus,
  iconCat,
  iconChartLineUp,
  iconChartNoAxesColumnIncreasing,
  iconCoffee,
  iconCoin,
  iconCookie,
  iconDeviceMobile,
  iconGameController,
  iconGift,
  iconHandshake,
  iconHospital,
  iconHouseLine,
  iconMoney,
  iconPiggyBank,
  iconPlane,
  iconShoppingBag,
  iconShoppingCart,
  iconSocial,
  iconSquaresFour,
  iconUtensils,
  iconWine,
} from "../utils/icons";

const props = defineProps<{
  categoryName: string;
  colorMode?: "category" | "type";
  entryType?: EntryType;
}>();

const categoryIconMap: Record<string, string> = {
  早餐: iconBread,
  午餐: iconBowlSteam,
  晚餐: iconUtensils,
  飲品: iconCoffee,
  點心: iconCookie,
  酒類: iconWine,
  交通: iconBus,
  購物: iconShoppingBag,
  娛樂: iconGameController,
  日用品: iconShoppingCart,
  房租: iconHouseLine,
  醫療: iconHospital,
  社交: iconSocial,
  禮物: iconGift,
  數位: iconDeviceMobile,
  貓咪: iconCat,
  旅行: iconPlane,
  其他: iconSquaresFour,
  薪水: iconMoney,
  獎金: iconCoin,
  交易: iconHandshake,
  投資: iconPiggyBank,
  股息: iconChartLineUp,
  利息: iconChartNoAxesColumnIncreasing,
};

const iconSvg = computed(
  () => categoryIconMap[props.categoryName] ?? iconSquaresFour,
);

const bgColor = computed<string | undefined>(() => {
  if (props.colorMode === "category") return getCategoryColor(props.categoryName) + "4D";
  if (props.colorMode === "type") {
    return props.entryType === "INCOME"
      ? "var(--janote-income-light)"
      : "var(--janote-expense-light)";
  }
  return undefined;
});
</script>

<template>
  <div
    class="category-icon-root"
    :style="bgColor ? { backgroundColor: bgColor } : {}"
    v-html="iconSvg"
  ></div>
</template>

<style scoped>
.category-icon-root {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.category-icon-root :deep(svg) {
  width: 24px;
  height: 24px;
  color: #333;
}
</style>
