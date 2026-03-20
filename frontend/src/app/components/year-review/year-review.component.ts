import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-year-review',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, DecimalPipe],
  template: `
    <div class="page-header">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h2>📅 {{ selectedYear }} Year Review</h2>
          <p>Annual financial summary across all pay periods</p>
        </div>
        <select [(ngModel)]="selectedYear" (ngModelChange)="load()" class="year-select">
          <option *ngFor="let y of data?.availableYears" [ngValue]="y">{{ y }}</option>
        </select>
      </div>
    </div>

    <div *ngIf="data && !data.configured" class="card" style="text-align: center; padding: 48px;">
      <div style="font-size: 2.4rem; margin-bottom: 12px;">⚙️</div>
      <p>Configure your paycheck first to see the year review.</p>
    </div>

    <div *ngIf="data?.noData" class="card" style="text-align: center; padding: 48px;">
      <div style="font-size: 2.4rem; margin-bottom: 12px;">📭</div>
      <p>{{ data.message }}</p>
    </div>

    <div *ngIf="data?.summary">
      <!-- Annual summary cards -->
      <div class="grid-4" style="margin-bottom: 24px;">
        <div class="card stat-card">
          <div class="stat-icon" style="background: var(--accent-dim); color: var(--accent);">💵</div>
          <div class="stat-value text-accent">{{ data.summary.totalIncome | currency }}</div>
          <div class="stat-label">Total Income ({{ data.payPeriods }} paychecks)</div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon" style="background: var(--warning-dim); color: var(--warning);">📋</div>
          <div class="stat-value text-warning">{{ data.summary.totalBills | currency }}</div>
          <div class="stat-label">Total Bills</div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon" style="background: var(--danger-dim); color: var(--danger);">🏦</div>
          <div class="stat-value text-danger">{{ data.summary.totalDebtPayments | currency }}</div>
          <div class="stat-label">Total Debt Payments</div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon" style="background: var(--info-dim); color: var(--info);">💰</div>
          <div class="stat-value text-info">{{ data.summary.totalTransfers | currency }}</div>
          <div class="stat-label">Total Transfers to Savings</div>
        </div>
      </div>

      <!-- Secondary stats -->
      <div class="grid-3" style="margin-bottom: 24px;">
        <div class="card stat-card">
          <div class="stat-value text-warning">{{ data.summary.totalExpenses | currency }}</div>
          <div class="stat-label">Total Discretionary Expenses</div>
        </div>
        <div class="card stat-card">
          <div class="stat-value text-accent">{{ data.summary.totalSnowballExtra | currency }}</div>
          <div class="stat-label">Extra Snowball Payments</div>
        </div>
        <div class="card stat-card">
          <div class="stat-value" [class.text-accent]="data.summary.netRemaining >= 0" [class.text-danger]="data.summary.netRemaining < 0">{{ data.summary.netRemaining | currency }}</div>
          <div class="stat-label">Net Remaining</div>
        </div>
      </div>

      <div class="grid-2" style="margin-bottom: 24px;">
        <!-- Bill totals -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">📋 Bills — Annual Totals</span>
          </div>
          <div *ngIf="!data.billTotals?.length" class="empty-state" style="padding: 20px;">
            <span class="text-muted">No bills</span>
          </div>
          <div *ngFor="let bill of data.billTotals" class="review-row">
            <div class="review-name">
              <span>
                {{ bill.name }}
                <span *ngIf="bill.isVariable" class="tag" style="background: var(--warning-dim); color: var(--warning); margin-left: 6px; font-size: 0.7rem;">Variable</span>
              </span>
              <span class="review-count text-muted">
                {{ bill.count }} payments
                <span *ngIf="bill.isVariable && bill.total !== bill.estimate"> · Est. {{ bill.estimate | currency }}</span>
              </span>
            </div>
            <span class="money">{{ bill.total | currency }}</span>
          </div>
          <div *ngIf="data.billTotals?.length" class="review-total">
            <span>Total Bills</span>
            <span class="money">{{ data.summary.totalBills | currency }}</span>
          </div>
        </div>

        <!-- Debt totals -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">🏦 Debts — Annual Totals</span>
          </div>
          <div *ngIf="!data.debtTotals?.length" class="empty-state" style="padding: 20px;">
            <span class="text-muted">No debts</span>
          </div>
          <div *ngFor="let debt of data.debtTotals" class="review-row">
            <div class="review-name">
              <span>{{ debt.name }}</span>
              <div class="review-breakdown text-muted">
                Min {{ debt.minimums | currency }}
                <span *ngIf="debt.extra > 0"> + {{ debt.extra | currency }} snowball</span>
                <span *ngIf="debt.actualPaid > 0"> · {{ debt.actualPaid | currency }} actually paid</span>
              </div>
            </div>
            <span class="money">{{ debt.totalPlanned || debt.minimums | currency }}</span>
          </div>
          <div *ngIf="data.debtTotals?.length" class="review-total">
            <span>Total Planned Debt Payments</span>
            <span class="money">{{ data.summary.totalDebtPayments | currency }}</span>
          </div>
          <div *ngIf="data.summary.totalActualDebtPayments > 0" class="review-total" style="border-top: none; padding-top: 4px;">
            <span class="text-muted">Actually Paid (recorded)</span>
            <span class="money text-accent">{{ data.summary.totalActualDebtPayments | currency }}</span>
          </div>
        </div>
      </div>

      <!-- Expense categories -->
      <div class="card" *ngIf="data.expensesByCategory?.length" style="margin-bottom: 24px;">
        <div class="card-header">
          <span class="card-title">🛒 Expenses by Category</span>
        </div>
        <div *ngFor="let cat of data.expensesByCategory" class="review-row">
          <div class="review-name">
            <span>
              <span class="cat-dot" [style.background]="cat.color || '#64748b'"></span>
              {{ cat.icon || '📦' }} {{ cat.category || 'Uncategorized' }}
            </span>
            <span class="review-count text-muted">{{ cat.count }} transactions</span>
          </div>
          <span class="money">{{ cat.total | currency }}</span>
        </div>
        <div class="review-total">
          <span>Total Expenses</span>
          <span class="money">{{ data.summary.totalExpenses | currency }}</span>
        </div>
      </div>

      <!-- Per-paycheck breakdown table -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">💵 Per-Paycheck Breakdown</span>
          <span class="tag" style="background: var(--accent-dim); color: var(--accent);">{{ data.payPeriods }} pay periods</span>
        </div>
        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Pay Date</th>
                <th style="text-align:right;">Income</th>
                <th style="text-align:right;">Bills</th>
                <th style="text-align:right;">Debt</th>
                <th style="text-align:right;">Snowball+</th>
                <th style="text-align:right;">Transfer</th>
                <th style="text-align:right;">Expenses</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let p of data.paycheckBreakdowns">
                <td>{{ p.payDate | date:'MMM d' }}</td>
                <td class="money" style="text-align:right;">{{ p.income | currency }}</td>
                <td class="money text-warning" style="text-align:right;">{{ p.bills | currency }}</td>
                <td class="money text-danger" style="text-align:right;">{{ p.debtMinimums | currency }}</td>
                <td class="money text-accent" style="text-align:right;">{{ p.snowballExtra > 0 ? '+' : '' }}{{ p.snowballExtra | currency }}</td>
                <td class="money text-info" style="text-align:right;">{{ p.transfer | currency }}</td>
                <td class="money" style="text-align:right;">{{ p.expenses | currency }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td style="font-weight: 700;">Totals</td>
                <td class="money text-accent" style="text-align:right; font-weight: 700;">{{ data.summary.totalIncome | currency }}</td>
                <td class="money text-warning" style="text-align:right; font-weight: 700;">{{ data.summary.totalBills | currency }}</td>
                <td class="money text-danger" style="text-align:right; font-weight: 700;">{{ getDebtMinsTotal() | currency }}</td>
                <td class="money text-accent" style="text-align:right; font-weight: 700;">+{{ data.summary.totalSnowballExtra | currency }}</td>
                <td class="money text-info" style="text-align:right; font-weight: 700;">{{ data.summary.totalTransfers | currency }}</td>
                <td class="money" style="text-align:right; font-weight: 700;">{{ data.summary.totalExpenses | currency }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .year-select {
      width: 120px;
      font-size: 1rem;
      font-weight: 600;
    }
    .stat-card {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .stat-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      margin-bottom: 4px;
    }
    .review-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid var(--border);
    }
    .review-row:last-of-type { border-bottom: none; }
    .review-name {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .review-name > span:first-child { font-weight: 500; font-size: 0.92rem; }
    .review-count { font-size: 0.78rem; }
    .review-breakdown { font-size: 0.78rem; }
    .review-total {
      display: flex;
      justify-content: space-between;
      padding: 14px 0 0;
      margin-top: 4px;
      border-top: 2px solid var(--border);
      font-weight: 700;
      font-size: 0.95rem;
    }
    .cat-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 6px;
      vertical-align: middle;
    }
    .table-scroll {
      overflow-x: auto;
    }
    .total-row td {
      border-top: 2px solid var(--border);
      padding-top: 14px;
    }
  `]
})
export class YearReviewComponent implements OnInit {
  data: any = null;
  selectedYear = new Date().getFullYear();

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.api.getYearReview(this.selectedYear).subscribe(d => {
      this.data = d;
      if (d.availableYears && !d.availableYears.includes(this.selectedYear)) {
        this.selectedYear = d.availableYears[d.availableYears.length - 1];
      }
    });
  }

  getDebtMinsTotal(): number {
    if (!this.data?.paycheckBreakdowns) return 0;
    return this.data.paycheckBreakdowns.reduce((s: number, p: any) => s + p.debtMinimums, 0);
  }
}
