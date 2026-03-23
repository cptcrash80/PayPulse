import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { PaycheckConfig } from '../../models/models';

@Component({
  selector: 'app-paychecks',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe],
  template: `
    <div class="page-header">
      <h2>Paycheck Configuration</h2>
      <p>Set up your bi-weekly pay schedule and automatic transfers</p>
    </div>

    <div class="grid-2">
      <!-- Config form -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Pay Setup</span>
        </div>

        <div class="form-group">
          <label>Net Paycheck Amount</label>
          <input type="number" [(ngModel)]="amount" placeholder="0.00" step="0.01" min="0">
        </div>

        <div class="form-group">
          <label>Next Upcoming Pay Date</label>
          <input type="date" [(ngModel)]="startDate">
          <small style="color: var(--text-muted); font-size: 0.78rem; margin-top: 4px; display: block;">
            Enter your next future payday — all calculations start from here
          </small>
        </div>

        <div class="form-group">
          <label>Auto-Transfer per Paycheck</label>
          <input type="number" [(ngModel)]="transferAmount" placeholder="0.00" step="0.01" min="0">
          <small style="color: var(--text-muted); font-size: 0.78rem; margin-top: 4px; display: block;">
            Amount moved to savings/other account each payday
          </small>
        </div>

        <div class="form-group">
          <label>Minimum Spending per Paycheck</label>
          <input type="number" [(ngModel)]="minimumSpending" placeholder="0.00" step="0.01" min="0">
          <small style="color: var(--text-muted); font-size: 0.78rem; margin-top: 4px; display: block;">
            Floor for discretionary spending — snowball won't go below this
          </small>
        </div>

        <button class="btn-primary" (click)="save()" style="width: 100%; margin-top: 8px;">
          {{ config ? 'Update' : 'Save' }} Configuration
        </button>
      </div>

      <!-- Current config display -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Current Settings</span>
        </div>

        <div *ngIf="!config" class="empty-state">
          <div class="empty-state-icon">⚙️</div>
          <div class="empty-state-text">Not configured yet</div>
        </div>

        <div *ngIf="config">
          <div class="config-item">
            <span class="text-muted">Net Pay</span>
            <span class="stat-value text-accent" style="font-size: 1.3rem;">{{ config.amount | currency }}</span>
          </div>
          <div class="config-item">
            <span class="text-muted">Pay Frequency</span>
            <span>Every 2 weeks</span>
          </div>
          <div class="config-item">
            <span class="text-muted">Auto-Transfer</span>
            <span class="money text-info">{{ config.transfer_amount | currency }}</span>
          </div>
          <div class="config-item">
            <span class="text-muted">Min Spending Reserve</span>
            <span class="money text-warning">{{ config.minimum_spending | currency }}</span>
          </div>
          <div class="config-item">
            <span class="text-muted">Monthly Income (est.)</span>
            <span class="money">{{ config.amount * 26 / 12 | currency }}</span>
          </div>
          <div class="config-item">
            <span class="text-muted">Annual Income (est.)</span>
            <span class="money">{{ config.amount * 26 | currency }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Upcoming pay dates -->
    <div class="card" style="margin-top: 24px;" *ngIf="config?.payDates?.length">
      <div class="card-header">
        <span class="card-title">Upcoming Pay Dates</span>
      </div>
      <div class="pay-dates-grid">
        <div *ngFor="let d of config.payDates?.slice(0, 12)" class="pay-date-chip" [class.next]="isNext(d)">
          <span class="pay-date-label" *ngIf="isNext(d)">Next</span>
          {{ d | date:'EEE, MMM d, y' }}
        </div>
      </div>
    </div>
  `,
  styles: [`
    .config-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 0;
      border-bottom: 1px solid var(--border);
    }
    .config-item:last-child { border-bottom: none; }
    .pay-dates-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 10px;
    }
    .pay-date-chip {
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 10px 14px;
      font-size: 0.88rem;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .pay-date-chip.next {
      border-color: var(--accent);
      background: var(--accent-dim);
    }
    .pay-date-label {
      font-size: 0.7rem;
      background: var(--accent);
      color: var(--bg-primary);
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 600;
    }
  `]
})
export class PaychecksComponent implements OnInit {
  config: PaycheckConfig | null = null;
  amount = 0;
  startDate = '';
  transferAmount = 0;
  minimumSpending = 0;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.api.getPaycheck().subscribe(c => {
      this.config = c;
      if (c) {
        this.amount = c.amount;
        this.startDate = c.start_date;
        this.transferAmount = c.transfer_amount;
        this.minimumSpending = c.minimum_spending || 0;
      }
    });
  }

  save() {
    if (!this.amount || !this.startDate) return;
    this.api.savePaycheck({
      amount: this.amount,
      start_date: this.startDate,
      transfer_amount: this.transferAmount || 0,
      minimum_spending: this.minimumSpending || 0
    }).subscribe(() => this.load());
  }

  isNext(date: string): boolean {
    if (!this.config?.payDates) return false;
    const today = new Date().toISOString().split('T')[0];
    const nextDate = this.config.payDates.find((d: string) => d > today);
    return date === nextDate;
  }
}
