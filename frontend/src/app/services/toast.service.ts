import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private counter = 0;
  toasts$ = new Subject<Toast>();
  remove$ = new Subject<number>();

  show(message: string, type: Toast['type'] = 'success', duration = 3000) {
    const id = ++this.counter;
    this.toasts$.next({ id, message, type, duration });
    if (duration > 0) {
      setTimeout(() => this.remove$.next(id), duration);
    }
    return id;
  }

  success(message: string) { return this.show(message, 'success'); }
  error(message: string) { return this.show(message, 'error', 5000); }
  info(message: string) { return this.show(message, 'info'); }
  warning(message: string) { return this.show(message, 'warning', 4000); }
}
