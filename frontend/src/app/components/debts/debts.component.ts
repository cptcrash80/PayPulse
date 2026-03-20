import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { Debt } from '../../models/models';

@Component({
  selector: 'app-debts',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe, DecimalPipe],
  template: `
    <div class="page-header">
      <h2>Debts</h2>
      <p>Track your debts and payoff progress. Surplus cash after bills is auto-allocated here.</p>
    </div>

    <!-- Summary -->
    <div class="grid-3" style="margin-bottom: 24px;" *ngIf="debts.length > 0">
      <div class="card stat-card">
        <div class="stat-value text-danger">{{ totalRemaining | currency }}</div>
        <div class="stat-label">Total Remaining</div>
      </div>
      <div class="card stat-card">
        <div class="stat-value text-warning">{{ totalMinPayments | currency }}</div>
        <div class="stat-label">Min Monthly Payments</div>
      </div>
      <div class="card stat-card">
        <div class="stat-value text-accent">{{ totalPaid | currency }}</div>
        <div class="stat-label">Total Paid Off</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">All Debts</span>
        <button class="btn-primary btn-sm" (click)="openModal()">+ Add Debt</button>
      </div>

      <div *ngIf="debts.length === 0" class="empty-state">
        <div class="empty-state-icon">🏦</div>
        <div class="empty-state-text">No debts tracked yet</div>
      </div>

      <div *ngFor="let debt of debts" class="debt-card">
        <div class="debt-header">
          <div>
            <h4>{{ debt.name }} <span *ngIf="debt.auto_pay" class="tag" style="background: var(--info-dim); color: var(--info); font-size: 0.7rem; font-weight: 600;">Auto-pay</span></h4>
            <div class="debt-meta text-muted">
              {{ debt.interest_rate }}% APR
              <span *ngIf="debt.due_day"> · Due {{ getOrdinal(debt.due_day) }}</span>
              · Min {{ debt.minimum_payment | currency }}/mo
            </div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="btn-sm btn-secondary" (click)="openPayment(debt)">💵 Payment</button>
            <button class="btn-icon" (click)="openModal(debt)">✏️</button>
            <button class="btn-icon" (click)="deleteDebt(debt)" style="color:var(--danger);">🗑️</button>
          </div>
        </div>

        <div class="debt-amounts">
          <span class="money text-accent">{{ debt.total_amount - debt.remaining_amount | currency }} paid</span>
          <span class="money text-danger">{{ debt.remaining_amount | currency }} remaining</span>
        </div>

        <div class="progress-bar" style="height: 10px; margin: 12px 0;">
          <div class="progress-fill" [style.width.%]="getPercent(debt)" style="background: var(--accent);"></div>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
          <span class="text-muted">{{ getPercent(debt) | number:'1.1-1' }}% complete</span>
          <span class="text-muted">of {{ debt.total_amount | currency }}</span>
        </div>

        <!-- Snowball payoff estimate -->
        <div class="payoff-estimate" *ngIf="debt.snowballEstimate">
          <div class="payoff-icon">⛄</div>
          <div *ngIf="debt.snowballEstimate.paidOff" class="payoff-text">
            <span class="text-accent" style="font-weight: 600;">Paid off by {{ debt.snowballEstimate.payoffPeriod | date:'MMMM d, y' }}</span>
          </div>
          <div *ngIf="!debt.snowballEstimate.paidOff" class="payoff-text">
            <span class="text-warning" style="font-weight: 500;">Est. payoff beyond 10-year window</span>
            <span class="text-muted" style="font-size: 0.78rem;"> · {{ debt.snowballEstimate.snowballRemaining | currency }} remaining after simulation</span>
          </div>
        </div>
        <div class="payoff-estimate none" *ngIf="!debt.snowballEstimate">
          <div class="payoff-icon">⚙️</div>
          <span class="text-muted">Configure paycheck to see payoff estimate</span>
        </div>

        <!-- Recent payments -->
        <div *ngIf="debt.payments?.length" class="debt-payments">
          <div class="payments-title text-muted">Recent Payments</div>
          <div *ngFor="let p of debt.payments.slice(0, 3)" class="payment-row">
            <span>{{ p.date | date:'MMM d, y' }}</span>
            <span class="money text-accent">{{ p.amount | currency }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Debt Modal -->
    <div class="modal-overlay" *ngIf="showModal" (click)="closeModals()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-title">{{ editing ? 'Edit' : 'Add' }} Debt</div>
        <div class="form-group">
          <label>Debt Name</label>
          <input type="text" [(ngModel)]="form.name" placeholder="e.g. Student Loan, Credit Card">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Total Amount</label>
            <input type="number" [(ngModel)]="form.total_amount" step="0.01" min="0">
          </div>
          <div class="form-group">
            <label>Remaining Amount</label>
            <input type="number" [(ngModel)]="form.remaining_amount" step="0.01" min="0">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Minimum Payment</label>
            <input type="number" [(ngModel)]="form.minimum_payment" step="0.01" min="0">
          </div>
          <div class="form-group">
            <label>Interest Rate (%)</label>
            <input type="number" [(ngModel)]="form.interest_rate" step="0.01" min="0">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Due Day</label>
            <input type="number" [(ngModel)]="form.due_day" min="1" max="31" placeholder="1-31">
          </div>
          <div class="form-group">
            <label>Priority (higher = first)</label>
            <input type="number" [(ngModel)]="form.priority" min="0">
          </div>
        </div>

        <div class="form-group" style="margin-top: 4px;">
          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; text-transform: none; letter-spacing: normal; font-size: 0.9rem;">
            <input type="checkbox" [(ngModel)]="form.auto_pay" style="width: auto; cursor: pointer;">
            Auto-pay enabled
          </label>
          <small style="color: var(--text-muted); font-size: 0.78rem; margin-top: 4px; display: block;">
            Auto-pay debts are locked to their due date and cannot be paid early by the balancer
          </small>
        </div>

        <div class="form-group">
          <label>Payment URL (optional)</label>
          <input type="url" [(ngModel)]="form.payment_url" placeholder="https://...">
        </div>

        <div *ngIf="error" style="background: var(--danger-dim); color: var(--danger); padding: 10px 14px; border-radius: var(--radius-sm); font-size: 0.85rem; margin-top: 8px;">
          {{ error }}
        </div>

        <div class="modal-actions">
          <button class="btn-secondary" (click)="closeModals()">Cancel</button>
          <button class="btn-primary" (click)="saveDebt()">{{ editing ? 'Update' : 'Add' }}</button>
        </div>
      </div>
    </div>

    <!-- Payment Modal -->
    <div class="modal-overlay" *ngIf="showPaymentModal" (click)="closeModals()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-title">Record Payment — {{ paymentDebt?.name }}</div>
        <div class="form-row">
          <div class="form-group">
            <label>Amount</label>
            <input type="number" [(ngModel)]="paymentForm.amount" step="0.01" min="0">
          </div>
          <div class="form-group">
            <label>Date</label>
            <input type="date" [(ngModel)]="paymentForm.date">
          </div>
        </div>
        <div class="form-group">
          <label>Notes (optional)</label>
          <input type="text" [(ngModel)]="paymentForm.notes" placeholder="e.g. Extra payment from bonus">
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" (click)="closeModals()">Cancel</button>
          <button class="btn-primary" (click)="recordPayment()">Record Payment</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .debt-card {
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 20px;
      margin-bottom: 16px;
    }
    .debt-card:last-child { margin-bottom: 0; }
    .debt-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    .debt-header h4 { font-size: 1.05rem; font-weight: 600; }
    .debt-meta { font-size: 0.82rem; margin-top: 4px; }
    .debt-amounts {
      display: flex;
      justify-content: space-between;
      font-size: 0.9rem;
    }
    .debt-payments {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px dashed var(--border);
    }
    .payments-title {
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }
    .payment-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      padding: 4px 0;
    }
    .payoff-estimate {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 14px;
      padding: 10px 14px;
      background: var(--accent-dim);
      border: 1px solid rgba(34, 211, 167, 0.15);
      border-radius: var(--radius-sm);
      font-size: 0.85rem;
    }
    .payoff-estimate.none {
      background: var(--bg-input);
      border-color: var(--border);
      font-size: 0.82rem;
    }
    .payoff-icon {
      font-size: 1.1rem;
      flex-shrink: 0;
    }
    .payoff-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
  `]
})
export class DebtsComponent implements OnInit {
  debts: Debt[] = [];
  showModal = false;
  showPaymentModal = false;
  editing: Debt | null = null;
  paymentDebt: Debt | null = null;
  error = '';
  form: any = { name: '', total_amount: 0, remaining_amount: 0, minimum_payment: 0, interest_rate: 0, due_day: null, priority: 0, auto_pay: false, payment_url: '' };
  paymentForm: any = { amount: 0, date: new Date().toISOString().split('T')[0], notes: '' };

  get totalRemaining() { return this.debts.reduce((s, d) => s + d.remaining_amount, 0); }
  get totalMinPayments() { return this.debts.reduce((s, d) => s + d.minimum_payment, 0); }
  get totalPaid() { return this.debts.reduce((s, d) => s + (d.total_amount - d.remaining_amount), 0); }

  constructor(private api: ApiService, private toast: ToastService) {}

  ngOnInit() { this.load(); }

  load() { this.api.getDebts().subscribe(d => this.debts = d); }

  openModal(debt?: Debt) {
    this.editing = debt || null;
    this.form = debt ? { ...debt, auto_pay: !!debt.auto_pay, payment_url: debt.payment_url || '' } : { name: '', total_amount: 0, remaining_amount: 0, minimum_payment: 0, interest_rate: 0, due_day: null, priority: 0, auto_pay: false, payment_url: '' };
    this.showModal = true;
    this.error = '';
  }

  openPayment(debt: Debt) {
    this.paymentDebt = debt;
    this.paymentForm = { amount: debt.minimum_payment, date: new Date().toISOString().split('T')[0], notes: '' };
    this.showPaymentModal = true;
  }

  closeModals() {
    this.showModal = false;
    this.showPaymentModal = false;
  }

  saveDebt() {
    if (!this.form.name) return;
    this.error = '';
    const payload = {
      name: this.form.name,
      total_amount: this.form.total_amount || 0,
      remaining_amount: this.form.remaining_amount ?? this.form.total_amount ?? 0,
      minimum_payment: this.form.minimum_payment || 0,
      interest_rate: this.form.interest_rate || 0,
      due_day: this.form.due_day || null,
      priority: this.form.priority || 0,
      is_active: 1,
      auto_pay: this.form.auto_pay ? 1 : 0,
      payment_url: this.form.payment_url || null
    };
    const isEdit = !!this.editing;
    const obs = isEdit
      ? this.api.updateDebt(this.editing!.id, payload)
      : this.api.createDebt(payload);
    obs.subscribe({
      next: () => { this.load(); this.closeModals(); this.toast.success(isEdit ? 'Debt updated' : 'Debt added'); },
      error: (err) => {
        this.error = err.error?.error || err.message || 'Save failed';
        this.toast.error('Failed to save debt');
      }
    });
  }

  deleteDebt(debt: Debt) {
    if (confirm(`Delete "${debt.name}"?`)) {
      this.api.deleteDebt(debt.id).subscribe({
        next: () => { this.load(); this.toast.success('Debt deleted'); },
        error: () => this.toast.error('Failed to delete debt')
      });
    }
  }

  recordPayment() {
    if (!this.paymentDebt || !this.paymentForm.amount) return;
    this.api.addDebtPayment(this.paymentDebt.id, this.paymentForm).subscribe({
      next: () => { this.load(); this.closeModals(); this.toast.success('Payment recorded'); },
      error: () => this.toast.error('Failed to record payment')
    });
  }

  getPercent(debt: Debt): number {
    return debt.total_amount > 0 ? (debt.total_amount - debt.remaining_amount) / debt.total_amount * 100 : 0;
  }

  getOrdinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    const idx = (v - 20) % 10;
    return n + (s[idx > 0 ? idx : 0] || s[v] || s[0]);
  }
}
