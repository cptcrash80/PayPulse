import { Component, OnInit, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { DashboardData } from '../../models/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, CurrencyPipe, DatePipe, DecimalPipe],
  template: `
    <div class="page-header">
      <h2>Dashboard</h2>
      <p>Your financial health at a glance</p>
    </div>

    <!-- Not configured state -->
    <div *ngIf="data && !data.configured" class="card" style="text-align:center; padding: 60px 24px;">
      <div style="font-size: 3rem; margin-bottom: 16px;">🚀</div>
      <h3 style="margin-bottom: 8px;">Welcome to PayPulse</h3>
      <p style="color: var(--text-secondary); margin-bottom: 24px;">Set up your paycheck to get started with your bi-weekly budget</p>
      <a routerLink="/paychecks" class="btn-primary" style="display:inline-flex;">Configure Paycheck →</a>
    </div>

    <!-- Dashboard content -->
    <div *ngIf="data?.configured">
      <!-- Top stat cards -->
      <div class="grid-4" style="margin-bottom: 24px;">
        <div class="card stat-card">
          <div class="stat-card-icon" style="background: var(--accent-dim); color: var(--accent);">💵</div>
          <div class="stat-value text-accent">{{ data.summary?.monthlyIncome | currency }}</div>
          <div class="stat-label">Monthly Income</div>
        </div>
        <div class="card stat-card">
          <div class="stat-card-icon" style="background: var(--warning-dim); color: var(--warning);">📋</div>
          <div class="stat-value text-warning">{{ data.summary?.monthlyBills | currency }}</div>
          <div class="stat-label">Monthly Bills</div>
        </div>
        <div class="card stat-card">
          <div class="stat-card-icon" style="background: var(--info-dim); color: var(--info);">💳</div>
          <div class="stat-value text-info">{{ data.summary?.totalDebtRemaining | currency }}</div>
          <div class="stat-label">Total Debt Remaining</div>
        </div>
        <div class="card stat-card">
          <div class="stat-card-icon" [style.background]="(data.summary?.freeCashPerPeriod ?? 0) >= 0 ? 'var(--accent-dim)' : 'var(--danger-dim)'" [style.color]="(data.summary?.freeCashPerPeriod ?? 0) >= 0 ? 'var(--accent)' : 'var(--danger)'">✨</div>
          <div class="stat-value" [class.text-accent]="(data.summary?.freeCashPerPeriod ?? 0) >= 0" [class.text-danger]="(data.summary?.freeCashPerPeriod ?? 0) < 0">{{ data.summary?.freeCashPerPeriod | currency }}</div>
          <div class="stat-label">Free Cash / Pay Period</div>
        </div>
      </div>

      <!-- Upcoming bills banner -->
      <div *ngIf="data.upcomingBills?.length" class="upcoming-banner card" style="margin-bottom: 24px;">
        <div class="upcoming-header">
          <span class="upcoming-icon">⏰</span>
          <span class="upcoming-title">{{ data.upcomingBills.length }} bill{{ data.upcomingBills.length > 1 ? 's' : '' }} due in the next 5 days</span>
        </div>
        <div class="upcoming-items">
          <div *ngFor="let bill of data.upcomingBills" class="upcoming-item">
            <div class="upcoming-item-left">
              <span class="upcoming-name">{{ bill.name }}</span>
              <span class="upcoming-due text-muted">{{ bill.daysUntil === 0 ? 'Due today' : bill.daysUntil === 1 ? 'Due tomorrow' : 'Due in ' + bill.daysUntil + ' days' }}</span>
            </div>
            <div class="upcoming-item-right">
              <span *ngIf="bill.autoPay" class="tag" style="background: var(--info-dim); color: var(--info); font-size: 0.7rem;">Auto</span>
              <span *ngIf="bill.isVariable" class="text-warning">~</span>
              <span class="money">{{ bill.amount | currency }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Charts row -->
      <div class="grid-3" style="margin-bottom: 24px;">
        <!-- Spending trend -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">Spending Trend (6 mo)</span>
          </div>
          <div class="chart-container">
            <canvas #spendingChart></canvas>
          </div>
        </div>

        <!-- Expense breakdown -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">Expenses by Category</span>
          </div>
          <div class="chart-container">
            <canvas #categoryChart></canvas>
          </div>
        </div>

        <!-- Debt breakdown -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">Debt Breakdown</span>
            <span class="tag" style="background: var(--danger-dim); color: var(--danger);">{{ data.summary?.totalDebtRemaining | currency }}</span>
          </div>
          <div class="chart-container" *ngIf="data.debtBreakdown?.length">
            <canvas #debtChart></canvas>
          </div>
          <div *ngIf="!data.debtBreakdown?.length" class="empty-state" style="padding: 24px;">
            <div class="empty-state-icon">🎉</div>
            <div class="empty-state-text">Debt free!</div>
          </div>
        </div>
      </div>

      <!-- Pay period breakdown -->
      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header">
          <span class="card-title">Pay Period Allocations</span>
          <a routerLink="/paychecks" class="btn-sm btn-secondary">All Paychecks →</a>
        </div>
        <div class="period-grid">
          <a *ngFor="let period of dashboardPeriods" class="period-card" [class.current]="isCurrentPeriod(period.payDate)" [class.past]="isPastPeriod(period.payDate)" [routerLink]="['/period', period.payDate]">
            <div class="period-date">
              <span class="period-label" *ngIf="isCurrentPeriod(period.payDate)">Current</span>
              <span class="period-label past-label" *ngIf="isPastPeriod(period.payDate)">Past</span>
              {{ period.payDate | date:'MMM d' }}
            </div>
            <div class="period-detail">
              <span class="text-muted">Bills</span>
              <span class="money text-warning">{{ period.totalBills | currency }}</span>
            </div>
            <div class="period-detail" *ngIf="period.totalSnowball > 0">
              <span class="text-muted">Debt (snowball)</span>
              <span class="money text-danger">{{ period.totalSnowball | currency }}</span>
            </div>
            <div class="period-detail" *ngIf="period.snowballExtra > 0">
              <span class="text-muted" style="font-size:0.78rem; padding-left: 10px;">↳ extra to debt</span>
              <span class="money text-accent" style="font-size:0.82rem;">+{{ period.snowballExtra | currency }}</span>
            </div>
            <div class="period-detail">
              <span class="text-muted">Transfer</span>
              <span class="money text-info">{{ period.transfer | currency }}</span>
            </div>
            <div class="period-detail" *ngIf="period.totalExpenses > 0">
              <span class="text-muted">Spent</span>
              <span class="money text-warning">{{ period.totalExpenses | currency }}</span>
            </div>
            <div class="period-detail available">
              <span>Remaining</span>
              <span class="money" [class.text-accent]="period.available >= 0" [class.text-danger]="period.available < 0">{{ period.available | currency }}</span>
            </div>
            <div class="period-detail min-floor" *ngIf="period.snowball?.minimumSpending > 0">
              <span class="text-muted" style="font-size:0.78rem;">Min spending floor</span>
              <span class="money text-muted" style="font-size:0.82rem;">{{ period.snowball.minimumSpending | currency }}</span>
            </div>
            <div class="period-items" *ngIf="period.bills.length > 0 || period.debts.length > 0">
              <div *ngFor="let bill of period.bills" class="period-line-item" [class.early]="bill.paidEarly">
                <span>📋 {{ bill.name }}<span *ngIf="bill.paidEarly" class="early-badge">early</span><span *ngIf="bill.autoPay" class="auto-badge">🔒</span></span>
                <span class="money">{{ bill.amount | currency }}</span>
              </div>
              <div *ngFor="let debt of period.debts" class="period-line-item debt-item" [class.early]="debt.paidEarly">
                <span>🏦 {{ debt.name }}<span *ngIf="debt.paidEarly" class="early-badge">early</span><span *ngIf="debt.autoPay" class="auto-badge">🔒</span><span *ngIf="debt.snowballOnly" class="early-badge" style="background: var(--accent-dim); color: var(--accent);">⛄</span></span>
                <span class="money">{{ debt.amount | currency }}</span>
              </div>
            </div>
            <div class="period-items empty" *ngIf="period.bills.length === 0 && period.debts.length === 0">
              <span class="text-muted" style="font-size: 0.82rem;">No obligations this period</span>
            </div>
            <div class="period-view-link">View Details →</div>
          </a>
        </div>
      </div>

      <!-- Bottom row -->
      <div class="grid-2">
        <!-- Snowball Plan -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">⛄ Debt Snowball Plan</span>
            <span *ngIf="data.snowball?.estimatedPeriodsToDebtFree" class="tag" style="background: var(--accent-dim); color: var(--accent);">
              ~{{ data.snowball.estimatedPeriodsToDebtFree }} pay periods
            </span>
          </div>
          <div *ngIf="!data.debtProgress?.length" class="empty-state" style="padding: 24px;">
            <div class="empty-state-icon">🎉</div>
            <div class="empty-state-text">No active debts — you're debt free!</div>
          </div>

          <!-- Payoff order -->
          <div *ngIf="data.snowball?.debtPayoffOrder?.length" class="snowball-order">
            <div *ngFor="let debt of data.snowball.debtPayoffOrder; let i = index" class="snowball-debt" [class.paid-off]="debt.paidOff">
              <div class="snowball-rank">{{ i + 1 }}</div>
              <div class="snowball-info">
                <div class="snowball-name">
                  {{ debt.name }}
                  <span *ngIf="debt.paidOff" class="paid-badge">Paid off by {{ debt.payoffPeriod | date:'MMM d, y' }}</span>
                  <span *ngIf="!debt.paidOff && i === 0" class="target-badge">← Target</span>
                </div>
                <div class="progress-bar" style="height: 6px; margin-top: 6px;">
                  <div class="progress-fill" [style.width.%]="getSnowballPercent(debt)" style="background: var(--accent);"></div>
                </div>
                <div class="snowball-meta text-muted">
                  {{ debt.totalAmount | currency }} total · {{ debt.currentRemaining | currency }} remaining
                </div>
              </div>
            </div>
          </div>

          <!-- Per-period snowball summary -->
          <div *ngIf="data.periodBreakdowns?.length" class="snowball-periods">
            <div class="snowball-periods-title text-muted">Per-Paycheck Summary</div>
            <table class="snowball-table">
              <thead>
                <tr>
                  <th>Pay Date</th>
                  <th>Target</th>
                  <th style="text-align:right;">Minimums</th>
                  <th style="text-align:right;">Extra</th>
                  <th style="text-align:right;">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let period of data.periodBreakdowns" class="snowball-table-row">
                  <td><a [routerLink]="['/period', period.payDate]" class="snowball-date-link">{{ period.payDate | date:'MMM d' }}</a></td>
                  <td class="snowball-target-cell">{{ period.snowball?.snowballTarget || '—' }}</td>
                  <td class="money" style="text-align:right;">{{ getSnowballMins(period) | currency }}</td>
                  <td class="money text-accent" style="text-align:right;">{{ period.snowball?.snowballExtra > 0 ? '+' : '' }}{{ period.snowball?.snowballExtra || 0 | currency }}</td>
                  <td class="money" style="text-align:right; font-weight: 600;">{{ period.snowball?.totalSnowball || 0 | currency }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Recent expenses -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">Recent Expenses</span>
            <a routerLink="/expenses" class="btn-sm btn-secondary">View All →</a>
          </div>
          <div *ngIf="!data.recentExpenses?.length" class="empty-state" style="padding: 24px;">
            <div class="empty-state-icon">📝</div>
            <div class="empty-state-text">No recent expenses</div>
          </div>
          <div *ngFor="let exp of data.recentExpenses?.slice(0, 6)" class="recent-expense-item">
            <div class="recent-expense-left">
              <span class="expense-cat-icon" [style.background]="(exp.category_color || '#64748b') + '20'" [style.color]="exp.category_color || '#64748b'">{{ exp.category_icon || '📦' }}</span>
              <div>
                <div class="expense-name">{{ exp.name }}</div>
                <div class="expense-date text-muted">{{ exp.date | date:'MMM d' }} · {{ exp.category_name || 'Uncategorized' }}</div>
              </div>
            </div>
            <span class="money text-danger">-{{ exp.amount | currency }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .stat-card {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .stat-card-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      margin-bottom: 4px;
    }
    .chart-container {
      position: relative;
      height: 240px;
    }
    .period-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    @media (max-width: 1024px) { .period-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 640px) { .period-grid { grid-template-columns: 1fr; } }
    .period-card {
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 16px;
      display: block;
      color: inherit;
      text-decoration: none;
      transition: border-color 200ms, transform 200ms;
    }
    .period-card:hover {
      border-color: var(--text-muted);
      transform: translateY(-2px);
      opacity: 1;
    }
    .period-card.current {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-dim);
    }
    .upcoming-banner {
      background: var(--bg-secondary);
      border-left: 4px solid var(--warning);
    }
    .upcoming-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    .upcoming-icon { font-size: 1.2rem; }
    .upcoming-title { font-weight: 600; font-size: 0.95rem; }
    .upcoming-items { display: flex; flex-direction: column; gap: 8px; }
    .upcoming-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: var(--bg-tertiary);
      border-radius: var(--radius-sm);
    }
    .upcoming-item-left { display: flex; flex-direction: column; gap: 2px; }
    .upcoming-name { font-weight: 500; font-size: 0.88rem; }
    .upcoming-due { font-size: 0.78rem; }
    .upcoming-item-right { display: flex; align-items: center; gap: 8px; }
    .period-date {
      font-weight: 700;
      font-size: 1.05rem;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .period-label {
      font-size: 0.7rem;
      background: var(--accent);
      color: var(--bg-primary);
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 600;
    }
    .period-label.past-label {
      background: var(--text-muted);
    }
    .period-card.past {
      opacity: 0.55;
    }
    .period-card.past:hover { opacity: 0.85; }
    .period-detail {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      padding: 4px 0;
    }
    .period-detail.available {
      border-top: 1px solid var(--border);
      margin-top: 6px;
      padding-top: 8px;
      font-weight: 600;
    }
    .period-items {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px dashed var(--border);
    }
    .period-line-item {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      padding: 3px 0;
      color: var(--text-secondary);
    }
    .period-line-item.debt-item {
      color: var(--danger);
      opacity: 0.85;
    }
    .period-line-item.early {
      font-style: italic;
    }
    .early-badge {
      display: inline-block;
      font-size: 0.65rem;
      background: var(--info-dim);
      color: var(--info);
      padding: 1px 5px;
      border-radius: 6px;
      margin-left: 6px;
      font-style: normal;
      font-weight: 600;
      vertical-align: middle;
    }
    .auto-badge {
      margin-left: 4px;
      font-size: 0.65rem;
      vertical-align: middle;
    }
    .period-view-link {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px solid var(--border);
      font-size: 0.8rem;
      color: var(--accent);
      text-align: center;
      font-weight: 500;
    }
    .debt-progress-item {
      margin-bottom: 20px;
    }
    .debt-progress-item:last-child { margin-bottom: 0; }
    .debt-progress-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 0.9rem;
      font-weight: 500;
    }
    .debt-progress-footer {
      display: flex;
      justify-content: space-between;
      margin-top: 6px;
      font-size: 0.78rem;
    }
    .recent-expense-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid var(--border);
    }
    .recent-expense-item:last-child { border-bottom: none; }
    .recent-expense-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .expense-cat-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
    }
    .expense-name { font-weight: 500; font-size: 0.9rem; }
    .expense-date { font-size: 0.78rem; }

    .snowball-order { margin-bottom: 20px; }
    .snowball-debt {
      display: flex;
      gap: 14px;
      padding: 12px 0;
      border-bottom: 1px solid var(--border);
    }
    .snowball-debt:last-child { border-bottom: none; }
    .snowball-debt.paid-off { opacity: 0.5; }
    .snowball-rank {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.78rem;
      font-weight: 700;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .snowball-info { flex: 1; min-width: 0; }
    .snowball-name { font-weight: 500; font-size: 0.9rem; }
    .snowball-meta { font-size: 0.78rem; margin-top: 4px; }
    .paid-badge {
      display: inline-block;
      font-size: 0.65rem;
      background: var(--accent-dim);
      color: var(--accent);
      padding: 1px 6px;
      border-radius: 6px;
      margin-left: 6px;
      font-weight: 600;
    }
    .target-badge {
      display: inline-block;
      font-size: 0.65rem;
      background: var(--warning-dim);
      color: var(--warning);
      padding: 1px 6px;
      border-radius: 6px;
      margin-left: 6px;
      font-weight: 600;
    }
    .snowball-periods {
      border-top: 1px solid var(--border);
      padding-top: 16px;
    }
    .snowball-periods-title {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 10px;
    }
    .snowball-table {
      width: 100%;
      border-collapse: collapse;
    }
    .snowball-table th {
      text-align: left;
      font-size: 0.7rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 6px 8px;
      border-bottom: 1px solid var(--border);
    }
    .snowball-table td {
      padding: 8px;
      font-size: 0.82rem;
      border-bottom: 1px solid var(--border);
    }
    .snowball-table tr:last-child td { border-bottom: none; }
    .snowball-date-link {
      color: var(--text-primary);
      font-weight: 500;
    }
    .snowball-date-link:hover { color: var(--accent); opacity: 1; }
    .snowball-target-cell {
      color: var(--text-secondary);
      font-size: 0.8rem;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `]
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('spendingChart') spendingChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('categoryChart') categoryChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('debtChart') debtChartRef!: ElementRef<HTMLCanvasElement>;

  data: DashboardData | null = null;
  private charts: any[] = [];
  private chartLoaded = false;
  private dataLoaded = false;

  private viewReady = false;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadChartJs().then(() => {
      this.chartLoaded = true;
      this.scheduleRender();
    });
    this.api.getDashboard().subscribe(d => {
      this.data = d;
      this.dataLoaded = true;
      this.scheduleRender();
    });
  }

  ngAfterViewInit() {
    this.viewReady = true;
    this.scheduleRender();
  }

  ngOnDestroy() {
    this.charts.forEach(c => c.destroy());
  }

  private loadChartJs(): Promise<void> {
    if (typeof Chart !== 'undefined') return Promise.resolve();
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
      script.onload = () => resolve();
      document.head.appendChild(script);
    });
  }

  private renderScheduled = false;
  private scheduleRender() {
    if (this.renderScheduled) return;
    this.renderScheduled = true;
    // Always defer to next tick so Angular has time to process DOM
    setTimeout(() => {
      this.renderScheduled = false;
      this.tryRenderCharts();
    }, 50);
  }

  private tryRenderCharts() {
    if (!this.chartLoaded || !this.dataLoaded || !this.viewReady || !this.data?.configured) return;
    if (!this.spendingChartRef || !this.categoryChartRef) return;

    this.charts.forEach(c => c.destroy());
    this.charts = [];

    this.renderSpendingChart();
    this.renderCategoryChart();
    this.renderDebtChart();
  }

  private renderSpendingChart() {
    const trend = this.data?.spendingTrend || [];
    const ctx = this.spendingChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, 'rgba(34, 211, 167, 0.3)');
    gradient.addColorStop(1, 'rgba(34, 211, 167, 0.0)');

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: trend.map((t: any) => t.month),
        datasets: [{
          label: 'Spending',
          data: trend.map((t: any) => t.total),
          borderColor: '#22d3a7',
          backgroundColor: gradient,
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#22d3a7',
          pointBorderColor: '#0c0f14',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1a1f2e',
            titleColor: '#e8ecf4',
            bodyColor: '#8b95a8',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            callbacks: {
              label: (ctx: any) => `$${ctx.parsed.y.toFixed(2)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#5a6478', font: { size: 11 } }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: {
              color: '#5a6478',
              font: { size: 11 },
              callback: (v: any) => '$' + v
            }
          }
        }
      }
    });
    this.charts.push(chart);
  }

  private renderCategoryChart() {
    const cats = this.data?.expensesByCategory || {};
    const entries = Object.entries(cats).sort((a, b) => b[1].total - a[1].total);
    if (entries.length === 0) return;

    const ctx = this.categoryChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: entries.map(e => e[0]),
        datasets: [{
          data: entries.map(e => e[1].total),
          backgroundColor: entries.map(e => e[1].color),
          borderColor: '#161b27',
          borderWidth: 3,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#8b95a8',
              font: { size: 11, family: 'DM Sans' },
              padding: 12,
              usePointStyle: true,
              pointStyleWidth: 10
            }
          },
          tooltip: {
            backgroundColor: '#1a1f2e',
            titleColor: '#e8ecf4',
            bodyColor: '#8b95a8',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            callbacks: {
              label: (ctx: any) => ` $${ctx.parsed.toFixed(2)}`
            }
          }
        }
      }
    });
    this.charts.push(chart);
  }

  private renderDebtChart() {
    const breakdown = (this.data as any)?.debtBreakdown || [];
    if (breakdown.length === 0 || !this.debtChartRef) return;

    const ctx = this.debtChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const colors = [
      '#f43f5e', '#f97316', '#f59e0b', '#8b5cf6', '#06b6d4',
      '#ec4899', '#10b981', '#3b82f6', '#64748b', '#14b8a6'
    ];

    const chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: breakdown.map((d: any) => d.name),
        datasets: [{
          data: breakdown.map((d: any) => d.remaining),
          backgroundColor: colors.slice(0, breakdown.length),
          borderColor: '#161b27',
          borderWidth: 3,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#8b95a8',
              font: { size: 11, family: 'DM Sans' },
              padding: 12,
              usePointStyle: true,
              pointStyleWidth: 10
            }
          },
          tooltip: {
            backgroundColor: '#1a1f2e',
            titleColor: '#e8ecf4',
            bodyColor: '#8b95a8',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
            callbacks: {
              label: (ctx: any) => {
                const total = ctx.dataset.data.reduce((s: number, v: number) => s + v, 0);
                const pct = ((ctx.parsed / total) * 100).toFixed(1);
                return ` $${ctx.parsed.toFixed(2)} (${pct}%)`;
              }
            }
          }
        }
      }
    });
    this.charts.push(chart);
  }

  isCurrentPeriod(payDate: string): boolean {
    if (!this.data?.currentPeriod) return false;
    return payDate === this.data.currentPeriod.start;
  }

  isPastPeriod(payDate: string): boolean {
    if (!this.data?.currentPeriod) return false;
    return payDate < this.data.currentPeriod.start;
  }

  get dashboardPeriods(): any[] {
    if (!this.data?.periodBreakdowns || !this.data?.currentPeriod) return this.data?.periodBreakdowns || [];
    const all = this.data.periodBreakdowns;
    const currentStart = this.data.currentPeriod.start;
    const currentIdx = all.findIndex((p: any) => p.payDate === currentStart);
    if (currentIdx === -1) return all.slice(0, 3);
    const start = Math.max(0, currentIdx - 1);
    const end = Math.min(all.length, currentIdx + 2); // current + 1 future
    return all.slice(start, end);
  }

  getSnowballPercent(debt: any): number {
    if (!debt.totalAmount || debt.totalAmount <= 0) return 0;
    return Math.max(0, Math.min(100, ((debt.totalAmount - debt.currentRemaining) / debt.totalAmount) * 100));
  }

  getSnowballMins(period: any): number {
    if (!period.snowball?.snowballPayments) return 0;
    return period.snowball.snowballPayments.reduce((s: number, p: any) => s + p.minimum, 0);
  }
}
