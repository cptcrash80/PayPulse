import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-simulator',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, DatePipe],
  template: `
    <div class="page-header">
      <h2>🔮 What-If Simulator</h2>
      <p>Test hypothetical changes to see how they affect your debt payoff timeline — nothing is saved</p>
    </div>

    <div class="grid-2" style="margin-bottom: 24px;">
      <!-- Controls -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Scenario Settings</span>
        </div>

        <div class="form-group">
          <label>Extra debt payment per paycheck</label>
          <input type="number" [(ngModel)]="params.extraDebtPayment" step="10" min="0" placeholder="0.00">
          <small class="text-muted" style="display:block; margin-top:4px; font-size:0.78rem;">Additional amount redirected from spending money to debt each period</small>
        </div>

        <div class="form-group">
          <label>Override paycheck amount</label>
          <input type="number" [(ngModel)]="params.paycheckOverride" step="10" min="0" placeholder="Leave blank for current">
          <small class="text-muted" style="display:block; margin-top:4px; font-size:0.78rem;">What if your paycheck was a different amount? (e.g. raise, new job)</small>
        </div>

        <div class="sim-section">
          <div class="sim-section-title">Add a hypothetical bill</div>
          <div class="form-row">
            <div class="form-group">
              <label>Name</label>
              <input type="text" [(ngModel)]="params.newBill.name" placeholder="e.g. Car payment">
            </div>
            <div class="form-group">
              <label>Amount</label>
              <input type="number" [(ngModel)]="params.newBill.amount" step="0.01" min="0" placeholder="0.00">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Due Day</label>
              <input type="number" [(ngModel)]="params.newBill.due_day" min="1" max="31" placeholder="1">
            </div>
            <div class="form-group">
              <label>Frequency</label>
              <select [(ngModel)]="params.newBill.frequency">
                <option value="monthly">Monthly</option>
                <option value="biweekly">Bi-Weekly</option>
              </select>
            </div>
          </div>
        </div>

        <button class="btn-primary" style="width: 100%; margin-top: 16px;" (click)="runSim()" [disabled]="loading">
          {{ loading ? 'Calculating...' : '🔮 Run Simulation' }}
        </button>
      </div>

      <!-- Results -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Results</span>
        </div>

        <div *ngIf="!result" class="empty-state" style="padding: 40px;">
          <div class="empty-state-icon">🔮</div>
          <div class="empty-state-text">Adjust the settings and run a simulation to see results</div>
        </div>

        <div *ngIf="result">
          <!-- Comparison cards -->
          <div class="comparison-grid">
            <div class="comparison-card">
              <div class="comparison-label text-muted">Current Plan</div>
              <div class="comparison-value">{{ result.baseline.periodsToDebtFree || '10+ yrs' }}</div>
              <div class="comparison-sub text-muted">pay periods to debt-free</div>
            </div>
            <div class="comparison-arrow">→</div>
            <div class="comparison-card simulated">
              <div class="comparison-label text-muted">With Changes</div>
              <div class="comparison-value text-accent">{{ result.simulation.periodsToDebtFree || '10+ yrs' }}</div>
              <div class="comparison-sub text-muted">pay periods to debt-free</div>
            </div>
          </div>

          <div *ngIf="result.comparison.periodsSaved" class="impact-banner" [class.positive]="result.comparison.periodsSaved > 0" [class.negative]="result.comparison.periodsSaved < 0">
            <span *ngIf="result.comparison.periodsSaved > 0">🎉 You'd be debt-free {{ result.comparison.periodsSaved }} pay periods sooner!</span>
            <span *ngIf="result.comparison.periodsSaved < 0">⚠️ This would add {{ -result.comparison.periodsSaved }} pay periods to your timeline</span>
          </div>

          <div class="result-details">
            <div class="result-row">
              <span class="text-muted">Avg obligations per paycheck</span>
              <span>
                {{ result.baseline.avgObligationsPerPeriod | currency }}
                <span [class.text-danger]="result.comparison.obligationChange > 0" [class.text-accent]="result.comparison.obligationChange < 0">
                  → {{ result.simulation.avgObligationsPerPeriod | currency }}
                </span>
              </span>
            </div>
            <div class="result-row">
              <span class="text-muted">Avg free cash per paycheck</span>
              <span>
                {{ result.baseline.avgFreePerPeriod | currency }}
                <span [class.text-accent]="result.comparison.freeCashChange > 0" [class.text-danger]="result.comparison.freeCashChange < 0">
                  → {{ result.simulation.avgFreePerPeriod | currency }}
                </span>
              </span>
            </div>
          </div>

          <!-- Debt payoff comparison -->
          <div class="payoff-comparison" *ngIf="result.simulation.debtPayoffOrder?.length">
            <div class="sim-section-title" style="margin-top: 16px;">Debt Payoff Order (Simulated)</div>
            <div *ngFor="let d of result.simulation.debtPayoffOrder; let i = index" class="payoff-row">
              <div class="payoff-rank">{{ i + 1 }}</div>
              <div class="payoff-info">
                <span class="payoff-name">{{ d.name }}</span>
                <span *ngIf="d.paidOff" class="text-accent" style="font-size: 0.82rem;"> · Paid off {{ d.payoffPeriod | date:'MMM y' }}</span>
                <span *ngIf="!d.paidOff" class="text-muted" style="font-size: 0.82rem;"> · {{ d.remaining | currency }} remaining</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .sim-section {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
    }
    .sim-section-title {
      font-size: 0.82rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 12px;
    }
    .comparison-grid {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
    }
    .comparison-card {
      flex: 1;
      text-align: center;
      padding: 16px;
      background: var(--bg-tertiary);
      border-radius: var(--radius-sm);
    }
    .comparison-card.simulated { border: 1px solid var(--accent); }
    .comparison-label { font-size: 0.78rem; margin-bottom: 4px; }
    .comparison-value { font-size: 1.6rem; font-weight: 700; font-family: var(--font-mono); }
    .comparison-sub { font-size: 0.75rem; margin-top: 2px; }
    .comparison-arrow { font-size: 1.4rem; color: var(--text-muted); }
    .impact-banner {
      padding: 14px 18px;
      border-radius: var(--radius-sm);
      font-weight: 600;
      font-size: 0.92rem;
      margin-bottom: 16px;
      text-align: center;
    }
    .impact-banner.positive { background: var(--accent-dim); color: var(--accent); }
    .impact-banner.negative { background: var(--warning-dim); color: var(--warning); }
    .result-details { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
    .result-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 14px;
      background: var(--bg-tertiary);
      border-radius: var(--radius-sm);
      font-size: 0.88rem;
    }
    .payoff-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid var(--border);
    }
    .payoff-row:last-child { border-bottom: none; }
    .payoff-rank {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--bg-tertiary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      font-weight: 700;
      flex-shrink: 0;
    }
    .payoff-name { font-weight: 500; }
  `]
})
export class SimulatorComponent implements OnInit {
  params: any = {
    extraDebtPayment: 0,
    paycheckOverride: null,
    newBill: { name: '', amount: 0, due_day: 1, frequency: 'monthly' },
    removedBillIds: [],
    removedDebtIds: []
  };
  result: any = null;
  loading = false;

  constructor(private api: ApiService) {}

  ngOnInit() {}

  runSim() {
    this.loading = true;
    const payload = {
      ...this.params,
      newBill: this.params.newBill.name && this.params.newBill.amount > 0 ? this.params.newBill : null,
      paycheckOverride: this.params.paycheckOverride || null
    };
    this.api.runSimulation(payload).subscribe({
      next: (r) => { this.result = r; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }
}
