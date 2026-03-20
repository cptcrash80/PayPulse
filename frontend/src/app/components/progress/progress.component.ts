import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ApiService } from '../../services/api.service';

declare var Chart: any;

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, DecimalPipe],
  template: `
    <div class="page-header">
      <h2>📈 Financial Progress</h2>
      <p>Debt paydown and savings growth over time</p>
    </div>

    <div *ngIf="data">
      <!-- Summary cards -->
      <div class="grid-4" style="margin-bottom: 24px;">
        <div class="card stat-card">
          <div class="stat-value text-danger">{{ data.summary.totalCurrentDebt | currency }}</div>
          <div class="stat-label">Total Debt Remaining</div>
        </div>
        <div class="card stat-card">
          <div class="stat-value text-accent">{{ data.summary.totalPaidOff | currency }}</div>
          <div class="stat-label">Total Paid Off ({{ data.summary.percentPaid | number:'1.1-1' }}%)</div>
        </div>
        <div class="card stat-card">
          <div class="stat-value text-info">{{ data.summary.totalSaved | currency }}</div>
          <div class="stat-label">Total Transferred to Savings</div>
        </div>
        <div class="card stat-card">
          <div class="stat-value" [class.text-accent]="data.summary.currentNetWorth >= 0" [class.text-danger]="data.summary.currentNetWorth < 0">
            {{ data.summary.currentNetWorth | currency }}
          </div>
          <div class="stat-label">Net Worth (Savings − Debt)</div>
        </div>
      </div>

      <!-- Overall progress bar -->
      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header">
          <span class="card-title">Debt Payoff Progress</span>
          <span class="tag" style="background: var(--accent-dim); color: var(--accent);">{{ data.summary.percentPaid | number:'1.1-1' }}% paid off</span>
        </div>
        <div class="progress-bar" style="height: 24px; border-radius: 12px; margin-top: 8px;">
          <div class="progress-fill" [style.width.%]="data.summary.percentPaid" style="background: var(--accent); border-radius: 12px; transition: width 600ms;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 0.82rem;">
          <span class="text-muted">{{ data.summary.totalPaidOff | currency }} paid</span>
          <span class="text-muted">{{ data.summary.totalCurrentDebt | currency }} remaining of {{ data.summary.totalOriginalDebt | currency }}</span>
        </div>
      </div>

      <!-- Chart -->
      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header">
          <span class="card-title">Debt vs Savings Over Time</span>
          <span class="text-muted" style="font-size: 0.78rem;">Dashed lines = projected</span>
        </div>
        <div class="chart-container" style="height: 350px;">
          <canvas #progressChart></canvas>
        </div>
      </div>

      <!-- Avg snowball info -->
      <div class="card" *ngIf="data.summary.avgSnowballPerPeriod > 0">
        <div class="card-header">
          <span class="card-title">⛄ Snowball Velocity</span>
        </div>
        <p style="font-size: 0.9rem; color: var(--text-secondary);">
          You're averaging <strong class="text-accent">{{ data.summary.avgSnowballPerPeriod | currency }}</strong> in total debt payments per paycheck.
          At this rate, you're on track to make real progress.
        </p>
      </div>
    </div>
  `,
  styles: [`
    .chart-container { position: relative; }
  `]
})
export class ProgressComponent implements OnInit {
  data: any = null;
  private chart: any = null;
  private viewReady = false;

  @ViewChild('progressChart') chartRef!: ElementRef;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getProgress().subscribe(d => {
      this.data = d;
      this.scheduleRender();
    });
  }

  ngAfterViewInit() {
    this.viewReady = true;
    if (this.data) this.scheduleRender();
  }

  private scheduleRender() {
    if (!this.viewReady) return;
    setTimeout(() => this.renderChart(), 50);
  }

  renderChart() {
    if (!this.chartRef?.nativeElement || !this.data) return;
    if (this.chart) this.chart.destroy();

    const timeline = this.data.timeline || [];
    const projections = this.data.projections || [];

    // Actual data
    const actualLabels = timeline.map((p: any) => p.date);
    const actualDebt = timeline.map((p: any) => p.totalDebt);
    const actualSavings = timeline.map((p: any) => p.totalSaved);
    const actualNet = timeline.map((p: any) => p.netWorth);

    // Projected data — start from last actual point
    const projLabels = projections.map((p: any) => p.date);
    const projDebt = projections.map((p: any) => p.totalDebt);
    const projSavings = projections.map((p: any) => p.totalSaved);

    const allLabels = [...actualLabels, ...projLabels];
    const debtData = [...actualDebt, ...new Array(projLabels.length).fill(null)];
    const savingsData = [...actualSavings, ...new Array(projLabels.length).fill(null)];
    const projDebtData = [...new Array(actualLabels.length).fill(null), ...projDebt];
    const projSavingsData = [...new Array(actualLabels.length).fill(null), ...projSavings];

    // Connect projected lines to last actual point
    if (actualLabels.length > 0 && projLabels.length > 0) {
      projDebtData[actualLabels.length - 1] = actualDebt[actualDebt.length - 1];
      projSavingsData[actualLabels.length - 1] = actualSavings[actualSavings.length - 1];
    }

    this.chart = new Chart(this.chartRef.nativeElement, {
      type: 'line',
      data: {
        labels: allLabels,
        datasets: [
          {
            label: 'Total Debt',
            data: debtData,
            borderColor: '#f43f5e',
            backgroundColor: 'rgba(244, 63, 94, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 2
          },
          {
            label: 'Total Savings',
            data: savingsData,
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 2
          },
          {
            label: 'Projected Debt',
            data: projDebtData,
            borderColor: '#f43f5e',
            borderDash: [6, 4],
            fill: false,
            tension: 0.3,
            pointRadius: 0
          },
          {
            label: 'Projected Savings',
            data: projSavingsData,
            borderColor: '#38bdf8',
            borderDash: [6, 4],
            fill: false,
            tension: 0.3,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { labels: { color: '#8b95a8', boxWidth: 14, padding: 16 } },
          tooltip: {
            backgroundColor: '#1a1f2e',
            titleColor: '#e8ecf4',
            bodyColor: '#8b95a8',
            borderColor: 'rgba(255,255,255,0.06)',
            borderWidth: 1,
            callbacks: {
              label: (ctx: any) => `${ctx.dataset.label}: $${ctx.raw?.toLocaleString() || '—'}`
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#5a6478', maxTicksLimit: 12, callback: (v: any, i: number) => {
              const d = allLabels[i];
              return d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) : '';
            }},
            grid: { color: 'rgba(255,255,255,0.03)' }
          },
          y: {
            ticks: { color: '#5a6478', callback: (v: any) => '$' + (v / 1000).toFixed(0) + 'k' },
            grid: { color: 'rgba(255,255,255,0.03)' }
          }
        }
      }
    });
  }
}
