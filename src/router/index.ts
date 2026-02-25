import { createRouter, createWebHistory } from 'vue-router'
import SyncView from '../views/SyncView.vue'
import DashboardView from '../views/DashboardView.vue'
import TransactionsView from '../views/TransactionsView.vue'
import TransactionEditView from '../views/TransactionEditView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/transactions' },
    { path: '/sync', name: 'sync', component: SyncView },
    { path: '/dashboard', name: 'dashboard', component: DashboardView },
    { path: '/transactions', name: 'transactions', component: TransactionsView },
    { path: '/transactions/new', name: 'transaction-new', component: TransactionEditView },
    { path: '/transaction/:id/edit', name: 'transaction-edit', component: TransactionEditView },
  ],
})

export default router
