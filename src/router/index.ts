import { createRouter, createWebHistory } from "vue-router";
import AccountView from "../views/AccountView.vue";
import AccountDetailView from "../views/AccountDetailView.vue";
import ProfileView from "../views/ProfileView.vue";
import TransactionSummaryView from "../views/TransactionSummaryView.vue";
import TransactionView from "../views/TransactionView.vue";
import TransactionSearchView from "../views/TransactionSearchView.vue";
import TransactionEditView from "../views/TransactionEditView.vue";
import TransactionBudgetView from "../views/TransactionBudgetView.vue";
import TransactionRecurringView from "../views/TransactionRecurringView.vue";


const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/transactions" },
    { path: "/profile", name: "profile", component: ProfileView },
    { path: "/accounts", name: "accounts", component: AccountView },
    {
      path: "/accounts/:id",
      name: "account-detail",
      component: AccountDetailView,
    },
    {
      path: "/transactions/summary",
      name: "transaction-summary",
      component: TransactionSummaryView,
    },
    {
      path: "/transactions",
      name: "transactions",
      component: TransactionView,
    },
    {
      path: "/transactions/search",
      name: "transaction-search",
      component: TransactionSearchView,
    },
    {
      path: "/transactions/new",
      name: "transaction-new",
      component: TransactionEditView,
    },
    {
      path: "/transaction/:id/edit",
      name: "transaction-edit",
      component: TransactionEditView,
    },
    {
      path: "/transactions/budget",
      name: "budget",
      component: TransactionBudgetView,
    },
    {
      path: "/transactions/budget/new",
      name: "budget-new",
      component: TransactionEditView,
    },
    {
      path: "/transactions/budget/:id/edit",
      name: "budget-edit",
      component: TransactionEditView,
    },
    {
      path: "/transactions/recurring",
      name: "recurring",
      component: TransactionRecurringView,
    },
    {
      path: "/transactions/recurring/new",
      name: "recurring-new",
      component: TransactionEditView,
    },
    {
      path: "/transactions/recurring/:id/edit",
      name: "recurring-edit",
      component: TransactionEditView,
    },
    {
      path: "/transactions/budget/recurring/new",
      name: "budget-recurring-new",
      component: TransactionEditView,
    },
    {
      path: "/transactions/budget/recurring/:id/edit",
      name: "budget-recurring-edit",
      component: TransactionEditView,
    },
  ],
});

export default router;
