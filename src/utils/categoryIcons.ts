// Category Icon Mapping
import iconBreakfast from '../assets/icons/icon-breakfast.svg?raw'
import iconLunch from '../assets/icons/icon-lunch.svg?raw'
import iconDinner from '../assets/icons/icon-dinner.svg?raw'
import iconFood from '../assets/icons/icon-food.svg?raw'
import iconBeverage from '../assets/icons/icon-beverage.svg?raw'
import iconSnack from '../assets/icons/icon-snack.svg?raw'
import iconWine from '../assets/icons/icon-wine.svg?raw'
import iconTransport from '../assets/icons/icon-transport.svg?raw'
import iconShopping from '../assets/icons/icon-shopping.svg?raw'
import iconEntertainment from '../assets/icons/icon-entertainment.svg?raw'
import iconDaily from '../assets/icons/icon-daily.svg?raw'
import iconRent from '../assets/icons/icon-rent.svg?raw'
import iconMedical from '../assets/icons/icon-medical.svg?raw'
import iconSocial from '../assets/icons/icon-social.svg?raw'
import iconGift from '../assets/icons/icon-gift.svg?raw'
import iconDigital from '../assets/icons/icon-digital.svg?raw'
import iconOther from '../assets/icons/icon-other.svg?raw'
import iconGroceries from '../assets/icons/icon-groceries.svg?raw'
import iconPhone from '../assets/icons/icon-phone.svg?raw'
import iconPet from '../assets/icons/icon-pet.svg?raw'
import iconTravel from '../assets/icons/icon-travel.svg?raw'
import iconSalary from '../assets/icons/icon-salary.svg?raw'
import iconBonus from '../assets/icons/icon-bonus.svg?raw'
import iconCashback from '../assets/icons/icon-cashback.svg?raw'
import iconTrade from '../assets/icons/icon-trade.svg?raw'
import iconDividend from '../assets/icons/icon-dividend.svg?raw'
import iconInterest from '../assets/icons/icon-interest.svg?raw'
import iconInvestment from '../assets/icons/icon-investment.svg?raw'
import iconRental from '../assets/icons/icon-rental.svg?raw'
import iconTravelBudget from '../assets/icons/icon-travel-budget.svg?raw'
import iconEducation from '../assets/icons/icon-education.svg?raw'
import iconDefault from '../assets/icons/icon-default.svg?raw'

// Category name to icon mapping
const categoryIconMap: Record<string, string> = {
  // Expense categories
  '早餐': iconBreakfast,
  '午餐': iconLunch,
  '晚餐': iconDinner,
  '餐飲': iconFood,
  '飲品': iconBeverage,
  '點心': iconSnack,
  '酒類': iconWine,
  '交通': iconTransport,
  '購物': iconShopping,
  '娛樂': iconEntertainment,
  '日用品': iconDaily,
  '房租': iconRent,
  '醫療': iconMedical,
  '社交': iconSocial,
  '禮物': iconGift,
  '數位': iconDigital,
  '其他': iconOther,
  '買菜基金': iconGroceries,
  '電信': iconPhone,
  '貓咪': iconPet,
  '旅行': iconTravel,
  '教育': iconEducation,
  
  // Income categories
  '薪水': iconSalary,
  '獎金': iconBonus,
  '回饋': iconCashback,
  '交易': iconTrade,
  '股息': iconDividend,
  '利息': iconInterest,
  '投資': iconInvestment,
  '租金': iconRental,
  '旅遊預算': iconTravelBudget,
}

/**
 * Get the SVG icon for a category by its name
 * @param categoryName - The name of the category
 * @returns The SVG string for the category icon
 */
export function getCategoryIcon(categoryName: string): string {
  return categoryIconMap[categoryName] || iconDefault
}


