import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-period-detail',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, RouterLink],
  template: `
    <div class="page-header">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 4px;">
        <a routerLink="/dashboard" class="back-link">← Dashboard</a>
      </div>
      <h2>Pay Period: {{ data?.payDate | date:'MMMM d, y' }}</h2>
      <p>{{ data?.payDate | date:'MMM d' }} — {{ data?.periodEnd | date:'MMM d, y' }}</p>
    </div>

    <!-- Period navigation -->
    <div class="period-nav" *ngIf="data">
      <a *ngIf="data.prevPeriod" [routerLink]="['/period', data.prevPeriod]" class="btn-secondary btn-sm">← {{ data.prevPeriod | date:'MMM d' }}</a>
      <span *ngIf="!data.prevPeriod"></span>
      <a *ngIf="data.nextPeriod" [routerLink]="['/period', data.nextPeriod]" class="btn-secondary btn-sm">{{ data.nextPeriod | date:'MMM d' }} →</a>
    </div>

    <!-- Money flow summary -->
    <div class="flow-card card" *ngIf="data">
      <div class="flow-row income">
        <span class="flow-label">Paycheck</span>
        <span class="money flow-amount text-accent">{{ data.paycheckAmount | currency }}</span>
      </div>

      <div class="flow-divider"></div>

      <div class="flow-row">
        <span class="flow-label">Bills</span>
        <span class="money flow-amount text-warning">-{{ data.totals.bills | currency }}</span>
      </div>
      <div class="flow-row">
        <span class="flow-label">Debt Minimums</span>
        <span class="money flow-amount text-danger">-{{ data.totals.debtMinimums | currency }}</span>
      </div>
      <div class="flow-row">
        <span class="flow-label">Savings Transfer</span>
        <span class="money flow-amount text-info">-{{ data.totals.transfer | currency }}</span>
      </div>

      <div class="flow-divider"></div>

      <div class="flow-row subtotal">
        <span class="flow-label">Committed</span>
        <span class="money flow-amount">-{{ data.totals.committed | currency }}</span>
      </div>
      <div class="flow-row highlight">
        <span class="flow-label">Available for Spending</span>
        <span class="money flow-amount" [class.text-accent]="data.totals.available >= 0" [class.text-danger]="data.totals.available < 0">{{ data.totals.available | currency }}</span>
      </div>

      <div class="flow-divider" *ngIf="data.totals.expenses > 0"></div>

      <div class="flow-row" *ngIf="data.totals.expenses > 0">
        <span class="flow-label">Spent This Period</span>
        <span class="money flow-amount text-warning">-{{ data.totals.expenses | currency }}</span>
      </div>
      <div class="flow-row highlight" *ngIf="data.totals.expenses > 0">
        <span class="flow-label">Remaining</span>
        <span class="money flow-amount" [class.text-accent]="data.totals.remaining >= 0" [class.text-danger]="data.totals.remaining < 0">{{ data.totals.remaining | currency }}</span>
      </div>
      <div class="flow-row surplus" *ngIf="data.totals.snowballExtra > 0">
        <span class="flow-label">⛄ Snowball Extra → Debt</span>
        <span class="money flow-amount text-accent">{{ data.totals.snowballExtra | currency }}</span>
      </div>
    </div>

    <!-- Snowball payments for this period -->
    <div class="card snowball-card" *ngIf="data?.snowball?.snowballPayments?.length" style="margin-top: 24px;">
      <div class="card-header">
        <span class="card-title">⛄ Snowball Payments This Period</span>
        <span class="tag" style="background: var(--accent-dim); color: var(--accent);">{{ data.snowball.totalSnowball | currency }} total</span>
      </div>
      <div class="snowball-target" *ngIf="data.snowball.snowballTarget">
        Current target: <strong>{{ data.snowball.snowballTarget }}</strong> (smallest balance)
      </div>
      <div *ngFor="let p of data.snowball.snowballPayments" class="snowball-payment-row">
        <div class="snowball-payment-left">
          <span class="detail-icon" [style.background]="p.extra > 0 ? 'var(--accent-dim)' : 'var(--danger-dim)'" [style.color]="p.extra > 0 ? 'var(--accent)' : 'var(--danger)'">🏦</span>
          <div>
            <div class="detail-name">{{ p.debtName }}</div>
            <div class="detail-meta text-muted">
              Min {{ p.minimum | currency }}
              <span *ngIf="p.extra > 0"> + {{ p.extra | currency }} extra</span>
              · {{ p.remainingAfter | currency }} remaining after
            </div>
          </div>
        </div>
        <span class="money" [class.text-accent]="p.extra > 0" [class.text-danger]="p.extra === 0">{{ p.total | currency }}</span>
      </div>
    </div>

    <!-- Detail sections -->
    <div class="grid-2" style="margin-top: 24px;" *ngIf="data">

      <!-- Bills -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">📋 Bills Due</span>
          <span class="tag" style="background: var(--warning-dim); color: var(--warning);">{{ paidBillsCount }}/{{ data.bills.length }} paid</span>
        </div>
        <div *ngIf="data.bills.length === 0" class="empty-state" style="padding: 20px;">
          <div class="empty-state-text text-muted">No bills this period</div>
        </div>
        <div *ngFor="let bill of data.bills" class="detail-row" [class.is-paid]="isPaid(bill.id || bill.name, 'bill')">
          <div class="detail-left">
            <button class="paid-check" [class.checked]="isPaid(bill.id || bill.name, 'bill')" (click)="togglePaid(bill.id || bill.name, 'bill')">
              {{ isPaid(bill.id || bill.name, 'bill') ? '✓' : '' }}
            </button>
            <span class="detail-icon" [style.background]="(bill.category_color || '#f59e0b') + '20'" [style.color]="bill.category_color || '#f59e0b'">{{ bill.category_icon || '📋' }}</span>
            <div>
              <div class="detail-name">{{ bill.name }} <span *ngIf="bill.paidEarly" class="early-badge">Paid Early</span></div>
              <div class="detail-meta text-muted">
                <span *ngIf="bill.dueDate">Due {{ bill.dueDate | date:'MMM d' }}</span>
                <span *ngIf="bill.frequency !== 'monthly'"> · {{ bill.frequency }}</span>
              </div>
            </div>
          </div>
          <div class="detail-right">
            <a *ngIf="bill.paymentUrl" [href]="bill.paymentUrl" target="_blank" rel="noopener" class="pay-link">Pay →</a>
            <span class="money text-warning">{{ bill.amount | currency }}</span>
          </div>
        </div>
        <div *ngIf="data.bills.length > 0" class="detail-total">
          <span>Total Bills</span>
          <span class="money">{{ data.totals.bills | currency }}</span>
        </div>
      </div>

      <!-- Debts -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">🏦 Debt Payments</span>
          <span class="tag" style="background: var(--danger-dim); color: var(--danger);">{{ paidDebtsCount }}/{{ data.debts.length }} paid</span>
        </div>
        <div *ngIf="data.debts.length === 0" class="empty-state" style="padding: 20px;">
          <div class="empty-state-text text-muted">No debt payments this period</div>
        </div>
        <div *ngFor="let debt of data.debts" class="detail-row" [class.is-paid]="isPaid(debt.debtId || debt.name, 'debt')">
          <div class="detail-left">
            <button class="paid-check" [class.checked]="isPaid(debt.debtId || debt.name, 'debt')" (click)="togglePaid(debt.debtId || debt.name, 'debt')">
              {{ isPaid(debt.debtId || debt.name, 'debt') ? '✓' : '' }}
            </button>
            <span class="detail-icon" style="background: var(--danger-dim); color: var(--danger);">🏦</span>
            <div>
              <div class="detail-name">{{ debt.name }} <span *ngIf="debt.paidEarly" class="early-badge">Paid Early</span></div>
              <div class="detail-meta text-muted">
                <span *ngIf="debt.dueDate">Due {{ debt.dueDate | date:'MMM d' }} · </span>
                {{ debt.remaining_amount | currency }} remaining
              </div>
            </div>
          </div>
          <div class="detail-right">
            <a *ngIf="debt.paymentUrl" [href]="debt.paymentUrl" target="_blank" rel="noopener" class="pay-link">Pay →</a>
            <span class="money text-danger">{{ debt.minimum_payment | currency }}</span>
          </div>
        </div>
        <div *ngIf="data.debts.length > 0" class="detail-total">
          <span>Total Minimums</span>
          <span class="money">{{ data.totals.debtMinimums | currency }}</span>
        </div>

        <!-- Actual payments made -->
        <div *ngIf="data.debtPayments?.length > 0" class="payments-section">
          <div class="payments-header text-muted">Payments Made This Period</div>
          <div *ngFor="let p of data.debtPayments" class="detail-row compact">
            <div>
              <span class="detail-name">{{ p.debt_name }}</span>
              <span class="detail-meta text-muted"> · {{ p.date | date:'MMM d' }}</span>
            </div>
            <span class="money text-accent">{{ p.amount | currency }}</span>
          </div>
          <div class="detail-total">
            <span>Total Paid</span>
            <span class="money text-accent">{{ data.totals.debtPaymentsMade | currency }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Expenses -->
    <div class="card" style="margin-top: 24px;" *ngIf="data">
      <div class="card-header">
        <span class="card-title">🛒 Expenses This Period</span>
        <span class="tag" style="background: var(--info-dim); color: var(--info);">{{ data.expenses.length }} items · {{ data.totals.expenses | currency }}</span>
      </div>
      <div *ngIf="data.expenses.length === 0" class="empty-state" style="padding: 24px;">
        <div class="empty-state-icon">✨</div>
        <div class="empty-state-text">No expenses recorded for this period</div>
        <a routerLink="/expenses" class="btn-primary btn-sm" style="margin-top: 8px;">Add Expense</a>
      </div>
      <table class="data-table" *ngIf="data.expenses.length > 0">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Category</th>
            <th style="text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let exp of data.expenses">
            <td>{{ exp.date | date:'MMM d' }}</td>
            <td style="font-weight: 500;">{{ exp.name }}</td>
            <td>
              <span class="tag" [style.background]="(exp.category_color || '#64748b') + '20'" [style.color]="exp.category_color || '#64748b'">
                {{ exp.category_icon || '📦' }} {{ exp.category_name || 'Uncategorized' }}
              </span>
            </td>
            <td class="money text-danger" style="text-align:right;">-{{ exp.amount | currency }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .back-link {
      font-size: 0.85rem;
      color: var(--text-secondary);
    }
    .back-link:hover { color: var(--accent); }

    .period-nav {
      display: flex;
      justify-content: space-between;
      margin-bottom: 24px;
    }

    .flow-card {
      padding: 0;
      overflow: hidden;
    }
    .flow-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 24px;
    }
    .flow-row.income {
      background: var(--accent-dim);
    }
    .flow-row.subtotal {
      background: rgba(255,255,255,0.02);
    }
    .flow-row.highlight {
      background: var(--bg-tertiary);
      font-weight: 600;
    }
    .flow-row.surplus {
      background: var(--accent-dim);
      border-top: 1px dashed var(--accent);
    }
    .flow-label { font-size: 0.92rem; }
    .flow-amount { font-size: 1.05rem; }
    .flow-divider {
      height: 1px;
      background: var(--border);
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid var(--border);
      transition: opacity 200ms;
    }
    .detail-row:last-child { border-bottom: none; }
    .detail-row.compact { padding: 8px 0; }
    .detail-row.is-paid {
      opacity: 0.45;
    }
    .detail-row.is-paid .detail-name {
      text-decoration: line-through;
    }
    .paid-check {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      border: 2px solid var(--border);
      background: transparent;
      color: transparent;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 150ms;
      padding: 0;
    }
    .paid-check:hover {
      border-color: var(--accent);
    }
    .paid-check.checked {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--bg-primary);
    }
    .detail-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .detail-right {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    .pay-link {
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--accent);
      background: var(--accent-dim);
      padding: 4px 10px;
      border-radius: 6px;
      white-space: nowrap;
      transition: all 150ms;
    }
    .pay-link:hover {
      background: var(--accent);
      color: var(--bg-primary);
      opacity: 1;
    }
    .detail-icon {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      flex-shrink: 0;
    }
    .detail-name { font-weight: 500; font-size: 0.92rem; }
    .detail-name .early-badge {
      display: inline-block;
      font-size: 0.65rem;
      background: var(--info-dim);
      color: var(--info);
      padding: 1px 6px;
      border-radius: 6px;
      margin-left: 6px;
      font-weight: 600;
      vertical-align: middle;
    }
    .detail-meta { font-size: 0.78rem; margin-top: 2px; }
    .detail-total {
      display: flex;
      justify-content: space-between;
      padding: 14px 0 0;
      margin-top: 8px;
      border-top: 2px solid var(--border);
      font-weight: 600;
      font-size: 0.95rem;
    }
    .payments-section {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px dashed var(--border);
    }
    .payments-header {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 8px;
    }
    .snowball-card { }
    .snowball-target {
      font-size: 0.85rem;
      color: var(--text-secondary);
      margin-bottom: 16px;
      padding: 8px 12px;
      background: var(--bg-tertiary);
      border-radius: var(--radius-sm);
    }
    .snowball-payment-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid var(--border);
    }
    .snowball-payment-row:last-child { border-bottom: none; }
    .snowball-payment-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
  `]
})
export class PeriodDetailComponent implements OnInit {
  data: any = null;
  paidMap: Record<string, boolean> = {};

  constructor(
    private route: ActivatedRoute,
    private api: ApiService
  ) {}

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const payDate = params.get('payDate');
      if (payDate) {
        this.api.getPeriodDetail(payDate).subscribe(d => this.data = d);
        this.api.getPaidItems(payDate).subscribe(m => this.paidMap = m);
      }
    });
  }

  togglePaid(itemId: string, itemType: string) {
    if (!this.data?.payDate) return;
    this.api.togglePaidItem(this.data.payDate, itemId, itemType).subscribe(m => this.paidMap = m);
  }

  isPaid(itemId: string, itemType: string): boolean {
    return !!this.paidMap[`${itemType}:${itemId}`];
  }

  get paidBillsCount(): number {
    if (!this.data?.bills) return 0;
    return this.data.bills.filter((b: any) => this.isPaid(b.id || b.name, 'bill')).length;
  }

  get paidDebtsCount(): number {
    if (!this.data?.debts) return 0;
    return this.data.debts.filter((d: any) => this.isPaid(d.debtId || d.name, 'debt')).length;
  }
}
