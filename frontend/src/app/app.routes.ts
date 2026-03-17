import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent) },
  { path: 'period/:payDate', loadComponent: () => import('./components/period-detail/period-detail.component').then(m => m.PeriodDetailComponent) },
  { path: 'paychecks', loadComponent: () => import('./components/paychecks/paychecks.component').then(m => m.PaychecksComponent) },
  { path: 'bills', loadComponent: () => import('./components/bills/bills.component').then(m => m.BillsComponent) },
  { path: 'expenses', loadComponent: () => import('./components/expenses/expenses.component').then(m => m.ExpensesComponent) },
  { path: 'debts', loadComponent: () => import('./components/debts/debts.component').then(m => m.DebtsComponent) },
  { path: 'categories', loadComponent: () => import('./components/categories/categories.component').then(m => m.CategoriesComponent) },
  { path: 'review', loadComponent: () => import('./components/year-review/year-review.component').then(m => m.YearReviewComponent) },
  { path: '**', redirectTo: 'dashboard' }
];
