import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { Category } from '../../models/models';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-header">
      <h2>Expense Categories</h2>
      <p>Customize categories for organizing your bills and expenses</p>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">Categories</span>
        <button class="btn-primary btn-sm" (click)="openModal()">+ Add Category</button>
      </div>

      <div class="categories-grid">
        <div *ngFor="let cat of categories" class="cat-card">
          <div class="cat-icon" [style.background]="cat.color + '20'" [style.color]="cat.color">
            {{ cat.icon }}
          </div>
          <div class="cat-info">
            <div class="cat-name">{{ cat.name }}</div>
            <div class="cat-meta text-muted" *ngIf="cat.is_default">Default</div>
          </div>
          <div class="cat-actions">
            <button class="btn-icon" (click)="openModal(cat)" title="Edit">✏️</button>
            <button class="btn-icon" *ngIf="!cat.is_default" (click)="deleteCategory(cat)" title="Delete" style="color:var(--danger);">🗑️</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-title">{{ editing ? 'Edit' : 'Add' }} Category</div>
        <div class="form-group">
          <label>Name</label>
          <input type="text" [(ngModel)]="form.name" placeholder="Category name">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Icon (Emoji)</label>
            <input type="text" [(ngModel)]="form.icon" placeholder="📁" maxlength="4">
          </div>
          <div class="form-group">
            <label>Color</label>
            <div style="display: flex; gap: 8px; align-items: center;">
              <input type="color" [(ngModel)]="form.color" style="width: 48px; height: 42px; padding: 2px; cursor: pointer;">
              <input type="text" [(ngModel)]="form.color" placeholder="#6366f1" style="flex:1;">
            </div>
          </div>
        </div>

        <div class="color-presets">
          <button *ngFor="let c of presetColors" class="color-preset" [style.background]="c" (click)="form.color = c" [class.active]="form.color === c"></button>
        </div>

        <div class="modal-actions">
          <button class="btn-secondary" (click)="closeModal()">Cancel</button>
          <button class="btn-primary" (click)="save()">{{ editing ? 'Update' : 'Add' }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .categories-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px;
    }
    .cat-card {
      display: flex;
      align-items: center;
      gap: 14px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 14px 16px;
    }
    .cat-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.3rem;
      flex-shrink: 0;
    }
    .cat-info { flex: 1; }
    .cat-name { font-weight: 600; font-size: 0.95rem; }
    .cat-meta { font-size: 0.78rem; }
    .cat-actions { display: flex; gap: 4px; }
    .color-presets {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 12px;
    }
    .color-preset {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      transition: all 150ms;
    }
    .color-preset:hover { transform: scale(1.15); }
    .color-preset.active { border-color: white; box-shadow: 0 0 0 2px var(--bg-primary); }
  `]
})
export class CategoriesComponent implements OnInit {
  categories: Category[] = [];
  showModal = false;
  editing: Category | null = null;
  form: any = { name: '', icon: '📁', color: '#6366f1' };
  error = '';

  presetColors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#ef4444',
    '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#10b981',
    '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#64748b'
  ];

  constructor(private api: ApiService) {}

  ngOnInit() { this.load(); }

  load() { this.api.getCategories().subscribe(c => this.categories = c); }

  openModal(cat?: Category) {
    this.editing = cat || null;
    this.form = cat ? { ...cat } : { name: '', icon: '📁', color: '#6366f1' };
    this.showModal = true;
    this.error = '';
  }

  closeModal() { this.showModal = false; }

  save() {
    if (!this.form.name) return;
    const obs = this.editing
      ? this.api.updateCategory(this.editing.id, this.form)
      : this.api.createCategory(this.form);
    obs.subscribe({
      next: () => { this.load(); this.closeModal(); },
      error: (e) => { this.error = e.error?.error || 'Failed'; }
    });
  }

  deleteCategory(cat: Category) {
    if (confirm(`Delete "${cat.name}"? Bills/expenses using it will become uncategorized.`)) {
      this.api.deleteCategory(cat.id).subscribe(() => this.load());
    }
  }
}
