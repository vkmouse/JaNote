// Category Icon Mapping
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
} from "./icons";

// Category name to icon mapping
const categoryIconMap: Record<string, string> = {
  // Expense categories
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

  // Income categories
  薪水: iconMoney,
  獎金: iconCoin,
  交易: iconHandshake,
  投資: iconPiggyBank,
  股息: iconChartLineUp,
  利息: iconChartNoAxesColumnIncreasing,
};

/**
 * Get the SVG icon for a category by its name
 * @param categoryName - The name of the category
 * @returns The SVG string for the category icon
 */
export function getCategoryIcon(categoryName: string): string {
  return categoryIconMap[categoryName] || iconSquaresFour;
}
