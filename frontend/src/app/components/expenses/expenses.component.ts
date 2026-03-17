import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Expense, Category } from '../../models/models';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe],
  template: `
    <div class="page-header">
      <h2>Expenses</h2>
      <p>Track one-time and on-the-fly spending</p>
    </div>

    <div class="card" style="margin-bottom: 24px;">
      <div class="card-header">
        <span class="card-title">Quick Add Expense</span>
      </div>
      <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 12px; align-items: end;">
        <div class="form-group" style="margin-bottom:0;">
          <label>Description</label>
          <input type="text" [(ngModel)]="quickForm.name" placeholder="What did you spend on?" (keyup.enter)="quickAdd()">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label>Amount</label>
          <input type="number" [(ngModel)]="quickForm.amount" step="0.01" min="0" placeholder="0.00" (keyup.enter)="quickAdd()">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label>Category</label>
          <select [(ngModel)]="quickForm.category_id">
            <option [ngValue]="null">None</option>
            <option *ngFor="let cat of categories" [ngValue]="cat.id">{{ cat.icon }} {{ cat.name }}</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label>Date</label>
          <input type="date" [(ngModel)]="quickForm.date">
        </div>
        <button class="btn-primary" (click)="quickAdd()" style="height: 42px;">Add</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">Expense History</span>
        <div style="display: flex; gap: 8px; align-items: center;">
          <select [(ngModel)]="filterCategory" (ngModelChange)="load()" style="width: 160px;">
            <option [ngValue]="''">All Categories</option>
            <option *ngFor="let cat of categories" [ngValue]="cat.id">{{ cat.icon }} {{ cat.name }}</option>
          </select>
        </div>
      </div>

      <div *ngIf="expenses.length === 0" class="empty-state">
        <div class="empty-state-icon">🛒</div>
        <div class="empty-state-text">No expenses recorded yet</div>
      </div>

      <table class="data-table" *ngIf="expenses.length > 0">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Category</th>
            <th>Amount</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let exp of expenses">
            <td>{{ exp.date | date:'MMM d, y' }}</td>
            <td style="font-weight: 500;">{{ exp.name }}</td>
            <td>
              <span class="tag" [style.background]="(exp.category_color || '#64748b') + '20'" [style.color]="exp.category_color || '#64748b'">
                {{ exp.category_icon || '📦' }} {{ exp.category_name || 'Uncategorized' }}
              </span>
            </td>
            <td class="money text-danger">-{{ exp.amount | currency }}</td>
            <td>
              <div style="display: flex; gap: 6px;">
                <button class="btn-icon" (click)="openEdit(exp)" title="Edit">✏️</button>
                <button class="btn-icon" (click)="deleteExpense(exp)" title="Delete" style="color: var(--danger);">🗑️</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div *ngIf="expenses.length > 0" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border); display: flex; justify-content: space-between;">
        <span class="text-muted">Total (shown)</span>
        <span class="money text-danger" style="font-size: 1.05rem; font-weight: 600;">-{{ totalShown | currency }}</span>
      </div>
    </div>

    <!-- Edit modal -->
    <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-title">Edit Expense</div>
        <div class="form-group">
          <label>Description</label>
          <input type="text" [(ngModel)]="editForm.name">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Amount</label>
            <input type="number" [(ngModel)]="editForm.amount" step="0.01" min="0">
          </div>
          <div class="form-group">
            <label>Date</label>
            <input type="date" [(ngModel)]="editForm.date">
          </div>
        </div>
        <div class="form-group">
          <label>Category</label>
          <select [(ngModel)]="editForm.category_id">
            <option [ngValue]="null">None</option>
            <option *ngFor="let cat of categories" [ngValue]="cat.id">{{ cat.icon }} {{ cat.name }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <input type="text" [(ngModel)]="editForm.notes" placeholder="Optional notes">
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" (click)="closeModal()">Cancel</button>
          <button class="btn-primary" (click)="saveEdit()">Update</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @media (max-width: 768px) {
      div[style*="grid-template-columns: 2fr"] {
        grid-template-columns: 1fr 1fr !important;
      }
    }
  `]
})
export class ExpensesComponent implements OnInit {
  expenses: Expense[] = [];
  categories: Category[] = [];
  filterCategory = '';
  showModal = false;
  editingId = '';
  editForm: any = {};
  quickForm: any = { name: '', amount: 0, category_id: null, date: new Date().toISOString().split('T')[0] };

  get totalShown(): number {
    return this.expenses.reduce((s, e) => s + e.amount, 0);
  }

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.load();
    this.api.getCategories().subscribe(c => this.categories = c);
  }

  load() {
    const params: any = {};
    if (this.filterCategory) params.category_id = this.filterCategory;
    this.api.getExpenses(params).subscribe(e => this.expenses = e);
  }

  quickAdd() {
    if (!this.quickForm.name || !this.quickForm.amount) return;
    this.api.createExpense(this.quickForm).subscribe(() => {
      this.quickForm = { name: '', amount: 0, category_id: null, date: new Date().toISOString().split('T')[0] };
      this.load();
    });
  }

  openEdit(exp: Expense) {
    this.editingId = exp.id;
    this.editForm = { ...exp };
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  saveEdit() {
    this.api.updateExpense(this.editingId, this.editForm).subscribe(() => {
      this.load();
      this.closeModal();
    });
  }

  deleteExpense(exp: Expense) {
    if (confirm(`Delete "${exp.name}"?`)) {
      this.api.deleteExpense(exp.id).subscribe(() => this.load());
    }
  }
}
