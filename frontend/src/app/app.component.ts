import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ToastComponent } from './components/toast/toast.component';
import { QuickExpenseComponent } from './components/quick-expense/quick-expense.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ToastComponent, QuickExpenseComponent],
  template: `
    <div class="app-shell">
      <button class="mobile-toggle" (click)="sidebarOpen = !sidebarOpen">☰</button>

      <aside class="sidebar" [class.open]="sidebarOpen">
        <div class="sidebar-brand">
          <h1>Pay<span>Pulse</span></h1>
          <p>Bi-Weekly Budget Planner</p>
        </div>
        <ul class="sidebar-nav">
          <li>
            <a routerLink="/dashboard" routerLinkActive="active" (click)="sidebarOpen = false">
              <span class="nav-icon">📊</span> Dashboard
            </a>
          </li>
          <li>
            <a routerLink="/paychecks" routerLinkActive="active" (click)="sidebarOpen = false">
              <span class="nav-icon">💵</span> Paycheck
            </a>
          </li>
          <li>
            <a routerLink="/bills" routerLinkActive="active" (click)="sidebarOpen = false">
              <span class="nav-icon">📋</span> Bills
            </a>
          </li>
          <li>
            <a routerLink="/expenses" routerLinkActive="active" (click)="sidebarOpen = false">
              <span class="nav-icon">🛒</span> Expenses
            </a>
          </li>
          <li>
            <a routerLink="/debts" routerLinkActive="active" (click)="sidebarOpen = false">
              <span class="nav-icon">🏦</span> Debts
            </a>
          </li>
          <li>
            <a routerLink="/subscriptions" routerLinkActive="active" (click)="sidebarOpen = false">
              <span class="nav-icon">🔄</span> Subscriptions
            </a>
          </li>
          <li>
            <a routerLink="/categories" routerLinkActive="active" (click)="sidebarOpen = false">
              <span class="nav-icon">🏷️</span> Categories
            </a>
          </li>
          <li>
            <a routerLink="/review" routerLinkActive="active" (click)="sidebarOpen = false">
              <span class="nav-icon">📅</span> Year Review
            </a>
          </li>
          <li>
            <a routerLink="/simulator" routerLinkActive="active" (click)="sidebarOpen = false">
              <span class="nav-icon">🔮</span> What-If
            </a>
          </li>
          <li>
            <a routerLink="/progress" routerLinkActive="active" (click)="sidebarOpen = false">
              <span class="nav-icon">📈</span> Progress
            </a>
          </li>
        </ul>
      </aside>

      <main class="main-content">
        <router-outlet></router-outlet>
      </main>
    </div>
    <app-toast></app-toast>
    <app-quick-expense></app-quick-expense>
  `
})
export class AppComponent {
  sidebarOpen = false;
}
