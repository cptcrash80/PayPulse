import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Category } from '../../models/models';

@Component({
  selector: 'app-subscriptions',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe],
  template: `
    <div class="page-header">
      <h2>Subscriptions</h2>
      <p>Recurring subscriptions are always auto-pay and cannot be paid early by the balancer</p>
    </div>

    <div class="card" style="margin-bottom: 24px;">
      <div class="card-header">
        <span class="card-title">All Subscriptions</span>
        <button class="btn-primary btn-sm" (click)="openModal()">+ Add Subscription</button>
      </div>

      <div *ngIf="subs.length === 0" class="empty-state">
        <div class="empty-state-icon">🔄</div>
        <div class="empty-state-text">No subscriptions yet. Add your first one.</div>
      </div>

      <table class="data-table" *ngIf="subs.length > 0">
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
          <tr *ngFor="let sub of subs">
            <td style="font-weight: 500;">
              {{ sub.name }}
              <span class="tag" style="background: var(--info-dim); color: var(--info); margin-left: 6px; font-size: 0.7rem;">Auto-pay</span>
            </td>
            <td>
              <span class="tag" [style.background]="(sub.category_color || '#64748b') + '20'" [style.color]="sub.category_color || '#64748b'">
                {{ sub.category_icon || '🔄' }} {{ sub.category_name || 'None' }}
              </span>
            </td>
            <td class="money">{{ sub.amount | currency }}</td>
            <td>{{ getOrdinal(sub.due_day) }}</td>
            <td style="text-transform: capitalize;">{{ sub.frequency }}</td>
            <td>
              <div style="display: flex; gap: 6px;">
                <button class="btn-icon" (click)="openModal(sub)" title="Edit">✏️</button>
                <button class="btn-icon" (click)="deleteSub(sub)" title="Delete" style="color: var(--danger);">🗑️</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div *ngIf="subs.length > 0" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); display: flex; justify-content: space-between;">
        <span class="text-muted">Total Monthly Subscriptions</span>
        <span class="money stat-value" style="font-size: 1.1rem;">{{ totalMonthly | currency }}</span>
      </div>
    </div>

    <!-- Modal -->
    <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-title">{{ editing ? 'Edit' : 'Add' }} Subscription</div>

        <div class="form-group">
          <label>Subscription Name</label>
          <input type="text" [(ngModel)]="form.name" placeholder="e.g. Netflix, Spotify, iCloud">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Amount</label>
            <input type="number" [(ngModel)]="form.amount" step="0.01" min="0" placeholder="0.00">
          </div>
          <div class="form-group">
            <label>Billing Day of Month</label>
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

        <div class="form-group">
          <label>Payment / Management URL (optional)</label>
          <input type="url" [(ngModel)]="form.payment_url" placeholder="https://...">
        </div>

        <div style="background: var(--info-dim); color: var(--info); padding: 10px 14px; border-radius: var(--radius-sm); font-size: 0.85rem; margin-top: 4px; display: flex; align-items: center; gap: 8px;">
          🔒 Subscriptions are always treated as auto-pay and will not be moved by the balancer.
        </div>

        <div *ngIf="error" style="background: var(--danger-dim); color: var(--danger); padding: 10px 14px; border-radius: var(--radius-sm); font-size: 0.85rem; margin-top: 8px;">
          {{ error }}
        </div>

        <div class="modal-actions">
          <button class="btn-secondary" (click)="closeModal()">Cancel</button>
          <button class="btn-primary" (click)="saveSub()">{{ editing ? 'Update' : 'Add' }} Subscription</button>
        </div>
      </div>
    </div>
  `
})
export class SubscriptionsComponent implements OnInit {
  subs: any[] = [];
  categories: Category[] = [];
  showModal = false;
  editing: any = null;
  error = '';
  form: any = { name: '', amount: 0, category_id: null, due_day: 1, frequency: 'monthly', payment_url: '' };

  get totalMonthly(): number {
    return this.subs.reduce((sum, s) => {
      if (s.frequency === 'monthly') return sum + s.amount;
      if (s.frequency === 'biweekly') return sum + (s.amount * 26 / 12);
      if (s.frequency === 'weekly') return sum + (s.amount * 52 / 12);
      return sum + s.amount;
    }, 0);
  }

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.load();
    this.api.getCategories().subscribe(c => this.categories = c);
  }

  load() {
    this.api.getSubscriptions().subscribe(s => this.subs = s);
  }

  openModal(sub?: any) {
    this.editing = sub || null;
    this.form = sub
      ? { name: sub.name, amount: sub.amount, category_id: sub.category_id, due_day: sub.due_day, frequency: sub.frequency, payment_url: sub.payment_url || '' }
      : { name: '', amount: 0, category_id: null, due_day: 1, frequency: 'monthly', payment_url: '' };
    this.showModal = true;
    this.error = '';
  }

  closeModal() {
    this.showModal = false;
    this.editing = null;
  }

  saveSub() {
    if (!this.form.name || !this.form.amount) return;
    this.error = '';
    const payload = {
      name: this.form.name,
      amount: this.form.amount,
      category_id: this.form.category_id || null,
      due_day: this.form.due_day,
      frequency: this.form.frequency || 'monthly',
      is_active: 1,
      payment_url: this.form.payment_url || null
    };
    const obs = this.editing
      ? this.api.updateSubscription(this.editing.id, payload)
      : this.api.createSubscription(payload);
    obs.subscribe({
      next: () => { this.load(); this.closeModal(); },
      error: (err) => { this.error = err.error?.error || 'Save failed'; }
    });
  }

  deleteSub(sub: any) {
    if (confirm(`Delete "${sub.name}"?`)) {
      this.api.deleteSubscription(sub.id).subscribe(() => this.load());
    }
  }

  getOrdinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    const idx = (v - 20) % 10;
    return n + (s[idx > 0 ? idx : 0] || s[v] || s[0]);
  }
}
