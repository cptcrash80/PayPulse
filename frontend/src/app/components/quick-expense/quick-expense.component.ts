import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { Category } from '../../models/models';

@Component({
  selector: 'app-quick-expense',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe],
  template: `
    <button class="fab" (click)="toggle()" [class.open]="isOpen" title="Quick add expense">
      <span class="fab-icon">{{ isOpen ? '✕' : '+' }}</span>
    </button>

    <div class="quick-panel" *ngIf="isOpen">
      <div class="quick-title">Quick Add Expense</div>
      <input type="text" [(ngModel)]="form.name" placeholder="What did you spend on?" (keyup.enter)="save()" class="quick-input" #nameInput>
      <div class="quick-row">
        <input type="number" [(ngModel)]="form.amount" placeholder="0.00" step="0.01" min="0" class="quick-input" (keyup.enter)="save()">
        <select [(ngModel)]="form.category_id" class="quick-input">
          <option [ngValue]="null">Category</option>
          <option *ngFor="let cat of categories" [ngValue]="cat.id">{{ cat.icon }} {{ cat.name }}</option>
        </select>
      </div>
      <input type="date" [(ngModel)]="form.date" class="quick-input">
      <button class="btn-primary quick-save" (click)="save()" [disabled]="!form.name || !form.amount">Add Expense</button>
    </div>

    <div class="quick-backdrop" *ngIf="isOpen" (click)="toggle()"></div>
  `,
  styles: [`
    .fab {
      position: fixed;
      bottom: 28px;
      right: 28px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--accent);
      color: var(--bg-primary);
      border: none;
      font-size: 1.6rem;
      font-weight: 300;
      cursor: pointer;
      z-index: 1001;
      box-shadow: 0 4px 16px var(--accent-glow);
      transition: all 200ms;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .fab:hover { transform: scale(1.08); }
    .fab.open { background: var(--bg-tertiary); color: var(--text-primary); box-shadow: var(--shadow-md); }
    .fab-icon { line-height: 1; }
    .quick-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.4);
      z-index: 999;
    }
    .quick-panel {
      position: fixed;
      bottom: 96px;
      right: 28px;
      width: 320px;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 20px;
      z-index: 1002;
      box-shadow: var(--shadow-lg);
      animation: slideUp 200ms ease;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .quick-title {
      font-weight: 700;
      font-size: 1rem;
      margin-bottom: 4px;
    }
    .quick-input {
      font-size: 0.88rem;
    }
    .quick-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .quick-save {
      width: 100%;
      margin-top: 4px;
    }
    @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    @media (max-width: 640px) {
      .fab { bottom: 20px; right: 20px; }
      .quick-panel { left: 16px; right: 16px; bottom: 88px; width: auto; }
    }
  `]
})
export class QuickExpenseComponent implements OnInit {
  isOpen = false;
  categories: Category[] = [];
  form = { name: '', amount: 0, category_id: null as string | null, date: new Date().toISOString().split('T')[0] };

  constructor(private api: ApiService, private toast: ToastService) {}

  ngOnInit() {
    this.api.getCategories().subscribe(c => this.categories = c);
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.form = { name: '', amount: 0, category_id: null, date: new Date().toISOString().split('T')[0] };
    }
  }

  save() {
    if (!this.form.name || !this.form.amount) return;
    this.api.createExpense(this.form).subscribe({
      next: () => {
        this.toast.success(`Added $${this.form.amount.toFixed(2)} expense: ${this.form.name}`);
        this.isOpen = false;
      },
      error: () => this.toast.error('Failed to save expense')
    });
  }
}
