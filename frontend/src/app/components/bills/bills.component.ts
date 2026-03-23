import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { RecurringBill, Category } from '../../models/models';

@Component({
  selector: 'app-bills',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe],
  template: `
    <div class="page-header">
      <h2>Recurring Bills</h2>
      <p>Manage your recurring monthly and bi-weekly bills</p>
    </div>

    <div class="card" style="margin-bottom: 24px;">
      <div class="card-header">
        <span class="card-title">All Bills</span>
        <button class="btn-primary btn-sm" (click)="openModal()">+ Add Bill</button>
      </div>

      <div *ngIf="bills.length === 0" class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-text">No bills yet. Add your first recurring bill.</div>
      </div>

      <table class="data-table" *ngIf="bills.length > 0">
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Amount</th>
            <th>Due Day</th>
            <th>Frequency</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let bill of bills">
            <td style="font-weight: 500;">
              {{ bill.name }}
              <span *ngIf="bill.auto_pay" class="tag" style="background: var(--info-dim); color: var(--info); margin-left: 6px; font-size: 0.7rem;">Auto-pay</span>
              <span *ngIf="bill.is_variable" class="tag" style="background: var(--warning-dim); color: var(--warning); margin-left: 6px; font-size: 0.7rem;">Variable</span>
            </td>
            <td>
              <span class="tag" [style.background]="(bill.category_color || '#64748b') + '20'" [style.color]="bill.category_color || '#64748b'">
                {{ bill.category_icon || '📁' }} {{ bill.category_name || 'None' }}
              </span>
            </td>
            <td class="money">
              <span *ngIf="bill.is_variable" class="text-warning">~</span>{{ bill.amount | currency }}
            </td>
            <td>{{ getOrdinal(bill.due_day) }}</td>
            <td style="text-transform: capitalize;">{{ bill.frequency }}</td>
            <td>
              <div style="display: flex; gap: 6px;">
                <button class="btn-icon" (click)="openModal(bill)" title="Edit">✏️</button>
                <button class="btn-icon" (click)="deleteBill(bill)" title="Delete" style="color: var(--danger);">🗑️</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div *ngIf="bills.length > 0" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); display: flex; justify-content: space-between;">
        <span class="text-muted">Total Monthly Bills</span>
        <span class="money stat-value" style="font-size: 1.1rem;">{{ totalMonthly | currency }}</span>
      </div>
    </div>

    <!-- Modal -->
    <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-title">{{ editing ? 'Edit' : 'Add' }} Bill</div>

        <div class="form-group">
          <label>Bill Name</label>
          <input type="text" [(ngModel)]="form.name" placeholder="e.g. Rent, Electric, Internet">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Amount</label>
            <input type="number" [(ngModel)]="form.amount" step="0.01" min="0" placeholder="0.00">
          </div>
          <div class="form-group">
            <label>Due Day of Month</label>
            <input type="number" [(ngModel)]="form.due_day" min="1" max="31" placeholder="1-31">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Category</label>
            <select [(ngModel)]="form.category_id">
              <option [ngValue]="null">None</option>
              <option *ngFor="let cat of categories" [ngValue]="cat.id">{{ cat.icon }} {{ cat.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Frequency</label>
            <select [(ngModel)]="form.frequency">
              <option value="monthly">Monthly</option>
              <option value="biweekly">Bi-Weekly</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
        </div>

        <div class="form-group" style="margin-top: 4px;">
          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; text-transform: none; letter-spacing: normal; font-size: 0.9rem;">
            <input type="checkbox" [(ngModel)]="form.auto_pay" style="width: auto; cursor: pointer;">
            Auto-pay enabled
          </label>
          <small style="color: var(--text-muted); font-size: 0.78rem; margin-top: 4px; display: block;">
            Auto-pay bills are locked to their due date and cannot be paid early by the balancer
          </small>
        </div>

        <div class="form-group" style="margin-top: 4px;">
          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; text-transform: none; letter-spacing: normal; font-size: 0.9rem;">
            <input type="checkbox" [(ngModel)]="form.is_variable" style="width: auto; cursor: pointer;">
            Variable amount
          </label>
          <small style="color: var(--text-muted); font-size: 0.78rem; margin-top: 4px; display: block;">
            Amount varies each month (e.g. utilities). The amount above is used as an estimate for budgeting — you can enter the actual amount on each pay period.
          </small>
        </div>

        <div class="form-group">
          <label>Payment URL (optional)</label>
          <input type="url" [(ngModel)]="form.payment_url" placeholder="https://...">
        </div>

        <div class="modal-actions">
          <button class="btn-secondary" (click)="closeModal()">Cancel</button>
          <button class="btn-primary" (click)="saveBill()">{{ editing ? 'Update' : 'Add' }} Bill</button>
        </div>
      </div>
    </div>
  `
})
export class BillsComponent implements OnInit {
  bills: RecurringBill[] = [];
  categories: Category[] = [];
  showModal = false;
  editing: RecurringBill | null = null;
  form: any = { name: '', amount: 0, category_id: null, due_day: 1, frequency: 'monthly', auto_pay: false, is_variable: false, payment_url: '' };

  get totalMonthly(): number {
    return this.bills.reduce((sum, b) => {
      if (b.frequency === 'monthly') return sum + b.amount;
      if (b.frequency === 'biweekly') return sum + (b.amount * 26 / 12);
      if (b.frequency === 'weekly') return sum + (b.amount * 52 / 12);
      return sum + b.amount;
    }, 0);
  }

  constructor(private api: ApiService, private toast: ToastService) {}

  ngOnInit() {
    this.load();
    this.api.getCategories().subscribe(c => this.categories = c);
  }

  load() {
    this.api.getBills().subscribe(b => this.bills = b);
  }

  openModal(bill?: RecurringBill) {
    this.editing = bill || null;
    this.form = bill
      ? { ...bill, auto_pay: !!bill.auto_pay, is_variable: !!(bill as any).is_variable, payment_url: bill.payment_url || '' }
      : { name: '', amount: 0, category_id: null, due_day: 1, frequency: 'monthly', auto_pay: false, is_variable: false, payment_url: '' };
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.editing = null;
  }

  saveBill() {
    if (!this.form.name || !this.form.amount) return;
    const payload = {
      name: this.form.name,
      amount: this.form.amount,
      category_id: this.form.category_id || null,
      due_day: this.form.due_day,
      frequency: this.form.frequency || 'monthly',
      is_active: 1,
      auto_pay: this.form.auto_pay ? 1 : 0,
      is_variable: this.form.is_variable ? 1 : 0,
      payment_url: this.form.payment_url || null
    };
    const isEdit = !!this.editing;
    const obs = isEdit
      ? this.api.updateBill(this.editing!.id, payload)
      : this.api.createBill(payload);
    obs.subscribe({
      next: () => { this.load(); this.closeModal(); this.toast.success(isEdit ? 'Bill updated' : 'Bill added'); },
      error: () => this.toast.error('Failed to save bill')
    });
  }

  deleteBill(bill: RecurringBill) {
    if (confirm(`Delete "${bill.name}"?`)) {
      this.api.deleteBill(bill.id).subscribe({
        next: () => { this.load(); this.toast.success('Bill deleted'); },
        error: () => this.toast.error('Failed to delete bill')
      });
    }
  }

  getOrdinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    const idx = (v - 20) % 10;
    return n + (s[idx > 0 ? idx : 0] || s[v] || s[0]);
  }
}
