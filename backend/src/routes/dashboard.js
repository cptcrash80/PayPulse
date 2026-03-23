const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { round2, calculatePayDates, getCurrentPayPeriod, buildPeriodShells,
        generateObligations, balanceAllocations, computeSnowball, runFullSnowball, projectSnowballPayoff } = require('../engine');

router.get('/', (req, res) => {
  const db = getDb();
  const config = db.prepare('SELECT * FROM paycheck_config ORDER BY created_at DESC LIMIT 1').get();
  if (!config) return res.json({ configured: false, message: 'Please set up your paycheck first' });

  const bills = db.prepare('SELECT * FROM recurring_bills WHERE is_active = 1').all();
  const debts = db.prepare('SELECT * FROM debts WHERE is_active = 1').all();
  const now = new Date();
  const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentExpenses = db.prepare(
    'SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color FROM expenses e LEFT JOIN categories c ON e.category_id = c.id WHERE e.date >= ? ORDER BY e.date DESC'
  ).all(thirtyDaysAgo.toISOString().split('T')[0]);

  // 6 periods for display
  const { balancedPeriods, snowball } = runFullSnowball(config, bills, debts, 6);

  // Long-term projection for payoff dates (uses avg free cash, not individual periods)
  const longSnowball = projectSnowballPayoff(balancedPeriods, debts, config);

  const payDates = balancedPeriods.map(p => p.payDate);
  const currentPeriod = getCurrentPayPeriod(payDates);
  const nextPayDate = payDates[0];

  // Merge snowball into periods
  for (const p of balancedPeriods) {
    const sa = snowball.periodAllocations.find(s => s.payDate === p.payDate);
    p.snowball = sa || null;
    p.snowballExtra = sa ? sa.snowballExtra : 0;
    p.totalSnowball = sa ? sa.totalSnowball : p.totalDebtMins;
    p.committed = round2(p.totalBills + (sa ? sa.totalSnowball : p.totalDebtMins) + p.transfer);
    p.available = round2(config.amount - p.committed);
  }

  // Aggregates
  const totalMonthlyBills = bills.reduce((sum, b) => {
    if (b.frequency === 'monthly') return sum + b.amount;
    if (b.frequency === 'biweekly') return sum + (b.amount * 26 / 12);
    if (b.frequency === 'weekly') return sum + (b.amount * 52 / 12);
    return sum + b.amount;
  }, 0);
  const totalMinDebtPayments = debts.reduce((sum, d) => sum + d.minimum_payment, 0);
  const totalDebtRemaining = debts.reduce((sum, d) => sum + d.remaining_amount, 0);
  const monthlyIncome = config.amount * 26 / 12;
  const monthlyTransfer = config.transfer_amount * 26 / 12;

  const expensesByCategory = {};
  for (const exp of recentExpenses) {
    const cat = exp.category_name || 'Uncategorized';
    if (!expensesByCategory[cat]) expensesByCategory[cat] = { total: 0, count: 0, icon: exp.category_icon || '📦', color: exp.category_color || '#64748b' };
    expensesByCategory[cat].total += exp.amount;
    expensesByCategory[cat].count++;
  }

  const spendingTrend = [];
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const me = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date >= ? AND date <= ?').get(monthStart.toISOString().split('T')[0], monthEnd.toISOString().split('T')[0]);
    spendingTrend.push({ month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), total: me.total });
  }

  const debtProgress = debts.map(d => ({
    name: d.name, total: d.total_amount, remaining: d.remaining_amount,
    paid: d.total_amount - d.remaining_amount,
    percentPaid: d.total_amount > 0 ? ((d.total_amount - d.remaining_amount) / d.total_amount * 100) : 0,
    interestRate: d.interest_rate
  }));

  // Debt breakdown for pie chart
  const debtBreakdown = debts
    .filter(d => d.is_active && d.remaining_amount > 0)
    .map(d => ({ name: d.name, remaining: d.remaining_amount }));

  const totalRecentExpenses = recentExpenses.reduce((s, e) => s + e.amount, 0);

  res.json({
    configured: true, paycheck: config, nextPayDate, currentPeriod,
    summary: {
      monthlyIncome: round2(monthlyIncome),
      monthlyBills: round2(totalMonthlyBills),
      monthlyTransfer: round2(monthlyTransfer),
      monthlyDebtPayments: round2(totalMinDebtPayments),
      totalDebtRemaining: round2(totalDebtRemaining),
      recentExpenses30d: round2(totalRecentExpenses),
      freeCashPerPeriod: round2(config.amount - config.transfer_amount - totalMonthlyBills / (26 / 12) - totalMinDebtPayments / (26 / 12))
    },
    periodBreakdowns: balancedPeriods,
    snowball: {
      debtPayoffOrder: longSnowball.debtPayoffOrder.map(d => {
        const src = debts.find(x => x.id === d.id);
        return {
          ...d,
          totalAmount: src ? src.total_amount : d.originalBalance,
          currentRemaining: src ? src.remaining_amount : d.originalBalance
        };
      }),
      estimatedPeriodsToDebtFree: longSnowball.estimatedPeriodsToDebtFree,
      allPaidInWindow: longSnowball.allPaidInWindow
    },
    debtBreakdown,
    expensesByCategory, spendingTrend, debtProgress,
    recentExpenses: recentExpenses.slice(0, 10)
  });
});

// ── Period Detail ───────────────────────────────────────────────────
router.get('/period/:payDate', (req, res) => {
  const db = getDb();
  const { payDate } = req.params;
  const config = db.prepare('SELECT * FROM paycheck_config ORDER BY created_at DESC LIMIT 1').get();
  if (!config) return res.status(400).json({ error: 'Paycheck not configured' });

  const bills = db.prepare('SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color FROM recurring_bills b LEFT JOIN categories c ON b.category_id = c.id WHERE b.is_active = 1').all();
  const debts = db.prepare('SELECT * FROM debts WHERE is_active = 1').all();

  const { balancedPeriods: balanced, snowball } = runFullSnowball(config, bills, debts, 26);
  const payDates = balanced.map(p => p.payDate);
  const idx = payDates.indexOf(payDate);
  if (idx === -1) return res.status(404).json({ error: 'Pay date not found in schedule' });

  const period = balanced[idx];
  const periodSnowball = snowball.periodAllocations[idx] || null;

  const periodExpenses = db.prepare(
    'SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color FROM expenses e LEFT JOIN categories c ON e.category_id = c.id WHERE e.date >= ? AND e.date < ? ORDER BY e.date DESC'
  ).all(period.periodStart, period.periodEnd);

  const periodDebtPayments = db.prepare(
    'SELECT dp.*, d.name as debt_name FROM debt_payments dp JOIN debts d ON dp.debt_id = d.id WHERE dp.date >= ? AND dp.date < ? ORDER BY dp.date DESC'
  ).all(period.periodStart, period.periodEnd);

  const totalBills = round2(period.bills.reduce((s, b) => s + b.amount, 0));
  const totalExpenses = round2(periodExpenses.reduce((s, e) => s + e.amount, 0));
  const totalDebtPaymentsMade = round2(periodDebtPayments.reduce((s, p) => s + p.amount, 0));
  const totalSnowball = periodSnowball ? periodSnowball.totalSnowball : period.totalDebtMins;
  const snowballExtra = periodSnowball ? periodSnowball.snowballExtra : 0;
  const committed = round2(totalBills + totalSnowball + config.transfer_amount);
  const available = round2(config.amount - committed);
  const remaining = round2(available - totalExpenses);

  const enrichedBills = period.bills.map(b => {
    const src = bills.find(o => o.name === b.name || (b.name.startsWith(o.name) && b.frequency === 'weekly'));
    return { ...b, category_name: src?.category_name || null, category_icon: src?.category_icon || null, category_color: src?.category_color || null };
  });
  const enrichedDebts = period.debts.map(d => {
    const src = debts.find(o => o.name === d.name);
    const se = periodSnowball?.snowballPayments.find(s => s.debtId === d.debtId);
    return {
      ...d, minimum_payment: d.amount,
      remaining_amount: d.remaining || src?.remaining_amount || 0,
      interest_rate: d.interestRate || src?.interest_rate || 0,
      snowballExtra: se?.extra || 0, snowballTotal: se?.total || d.amount,
      remainingAfterSnowball: se?.remainingAfter ?? (d.remaining || src?.remaining_amount || 0)
    };
  });

  res.json({
    payDate: period.periodStart, periodEnd: period.periodEnd,
    prevPeriod: idx > 0 ? payDates[idx - 1] : null,
    nextPeriod: idx < payDates.length - 1 ? payDates[idx + 1] : null,
    paycheckAmount: config.amount, transfer: config.transfer_amount,
    bills: enrichedBills, debts: enrichedDebts,
    expenses: periodExpenses, debtPayments: periodDebtPayments, snowball: periodSnowball,
    totals: {
      bills: totalBills, debtMinimums: round2(period.totalDebtMins),
      snowballExtra, totalSnowball, transfer: config.transfer_amount,
      committed, expenses: totalExpenses, debtPaymentsMade: totalDebtPaymentsMade,
      available, remaining, freeCash: periodSnowball?.freeCash || available
    }
  });
});

module.exports = router;
