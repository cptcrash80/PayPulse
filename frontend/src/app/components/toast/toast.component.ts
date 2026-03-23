import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ToastService, Toast } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      <div *ngFor="let toast of toasts" class="toast" [class]="'toast-' + toast.type" (click)="dismiss(toast.id)">
        <span class="toast-icon">{{ getIcon(toast.type) }}</span>
        <span class="toast-msg">{{ toast.message }}</span>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column-reverse;
      gap: 8px;
      max-width: 380px;
    }
    .toast {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 18px;
      border-radius: 10px;
      font-size: 0.88rem;
      font-weight: 500;
      cursor: pointer;
      animation: toastIn 200ms ease;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    }
    .toast-success { background: #065f46; color: #a7f3d0; }
    .toast-error { background: #7f1d1d; color: #fecaca; }
    .toast-info { background: #1e3a5f; color: #bfdbfe; }
    .toast-warning { background: #78350f; color: #fde68a; }
    .toast-icon { font-size: 1.1rem; }
    @keyframes toastIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    @media (max-width: 640px) {
      .toast-container { left: 16px; right: 16px; bottom: 16px; max-width: none; }
    }
  `]
})
export class ToastComponent implements OnInit, OnDestroy {
  toasts: Toast[] = [];
  private subs: Subscription[] = [];

  constructor(private toastService: ToastService) {}

  ngOnInit() {
    this.subs.push(
      this.toastService.toasts$.subscribe(t => this.toasts.push(t)),
      this.toastService.remove$.subscribe(id => this.toasts = this.toasts.filter(t => t.id !== id))
    );
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  dismiss(id: number) {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }

  getIcon(type: string): string {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      case 'info': return 'ℹ';
      default: return '•';
    }
  }
}
