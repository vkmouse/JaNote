// Category Icon Mapping
import iconBowlSteam from "../assets/icons/new/icon-bowl-steam.svg?raw";
import iconBread from "../assets/icons/new/icon-bread.svg?raw";
import iconBus from "../assets/icons/new/icon-bus.svg?raw";
import iconCat from "../assets/icons/new/icon-cat.svg?raw";
import iconChartLineUp from "../assets/icons/new/icon-chart-line-up.svg?raw";
import iconChartNoAxesColumnIncreasing from "../assets/icons/new/icon-chart-no-axes-column-increasing.svg?raw";
import iconCoffee from "../assets/icons/new/icon-coffee.svg?raw";
import iconCoin from "../assets/icons/new/icon-coin.svg?raw";
import iconCookie from "../assets/icons/new/icon-cookie.svg?raw";
import iconDeviceMobile from "../assets/icons/new/icon-device-mobile.svg?raw";
import iconGameController from "../assets/icons/new/icon-game-controller.svg?raw";
import iconGift from "../assets/icons/new/icon-gift.svg?raw";
import iconHandshake from "../assets/icons/new/icon-handshake.svg?raw";
import iconHospital from "../assets/icons/new/icon-hospital.svg?raw";
import iconHouseLine from "../assets/icons/new/icon-house-line.svg?raw";
import iconMoney from "../assets/icons/new/icon-money.svg?raw";
import iconPiggyBank from "../assets/icons/new/icon-piggy-bank.svg?raw";
import iconPlane from "../assets/icons/new/icon-plane.svg?raw";
import iconShoppingBag from "../assets/icons/new/icon-shopping-bag.svg?raw";
import iconShoppingCart from "../assets/icons/new/icon-shopping-cart.svg?raw";
import iconSocial from "../assets/icons/icon-social.svg?raw";
import iconSquaresFour from "../assets/icons/new/icon-squares-four.svg?raw";
import iconUtensils from "../assets/icons/new/icon-utensils.svg?raw";
import iconWine from "../assets/icons/new/icon-wine.svg?raw";

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
