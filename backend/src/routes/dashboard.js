const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { round2, calculatePayDates, getCurrentPayPeriod, buildPeriodShells,
        generateObligations, balanceAllocations, computeSnowball, runFullSnowball, projectSnowballPayoff, getBillsWithSubscriptions } = require('../engine');

router.get('/', (req, res) => {
  const db = getDb();
  const config = db.prepare('SELECT * FROM paycheck_config ORDER BY created_at DESC LIMIT 1').get();
  if (!config) return res.json({ configured: false, message: 'Please set up your paycheck first' });

  const bills = getBillsWithSubscriptions();
  const debts = db.prepare('SELECT * FROM debts WHERE is_active = 1').all();
  const now = new Date();
  const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentExpenses = db.prepare(
    'SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color FROM expenses e LEFT JOIN categories c ON e.category_id = c.id WHERE e.date >= ? ORDER BY e.date DESC'
  ).all(thirtyDaysAgo.toISOString().split('T')[0]);

  // 4 future periods + 1 past for display
  const { balancedPeriods, snowball } = runFullSnowball(config, bills, debts, 4, 1);

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

    // Add snowball-only debts (debts receiving extra but not allocated a minimum this period)
    if (sa?.snowballPayments) {
      for (const sp of sa.snowballPayments) {
        const alreadyListed = p.debts.find(d => d.debtId === sp.debtId || d.name === sp.debtName);
        if (!alreadyListed && sp.total > 0) {
          p.debts.push({
            name: sp.debtName,
            debtId: sp.debtId,
            amount: sp.total,
            dueDate: null,
            frequency: 'snowball',
            paidEarly: false,
            autoPay: false,
            snowballOnly: true
          });
        } else if (alreadyListed) {
          // Update amount to include snowball extra
          alreadyListed.amount = sp.total;
        }
      }
    }
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
    recentExpenses: recentExpenses.slice(0, 10),
    upcomingBills: getUpcomingBills(bills, 5)
  });
});

function getUpcomingBills(bills, daysAhead) {
  const today = new Date();
  const upcoming = [];
  for (const bill of bills) {
    if (bill.frequency !== 'monthly') continue;
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), bill.due_day);
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, bill.due_day);
    for (const dueDate of [thisMonth, nextMonth]) {
      const diff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diff >= 0 && diff <= daysAhead) {
        upcoming.push({
          name: bill.name,
          amount: bill.amount,
          dueDate: dueDate.toISOString().split('T')[0],
          daysUntil: diff,
          autoPay: bill.auto_pay ? true : false,
          isVariable: bill.is_variable ? true : false
        });
      }
    }
  }
  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
}

// ── Period Detail ───────────────────────────────────────────────────
router.get('/period/:payDate', (req, res) => {
  const db = getDb();
  const { payDate } = req.params;
  const config = db.prepare('SELECT * FROM paycheck_config ORDER BY created_at DESC LIMIT 1').get();
  if (!config) return res.status(400).json({ error: 'Paycheck not configured' });

  const bills = getBillsWithSubscriptions();
  const debts = db.prepare('SELECT * FROM debts WHERE is_active = 1').all();

  const { balancedPeriods: balanced, snowball } = runFullSnowball(config, bills, debts, 26, 6);
  const payDates = balanced.map(p => p.payDate);
  const idx = payDates.indexOf(payDate);
  if (idx === -1) return res.status(404).json({ error: 'Pay date not found in schedule' });

  const period = balanced[idx];
  const periodSnowball = snowball.periodAllocations.find(sa => sa.payDate === payDate) || null;

  console.log(`Period detail ${payDate}: idx=${idx}, snowball found=${!!periodSnowball}, snowball payments=${periodSnowball?.snowballPayments?.length || 0}, period.debts=${period.debts.length}`);
  if (periodSnowball?.snowballPayments) {
    for (const sp of periodSnowball.snowballPayments) {
      console.log(`  Snowball payment: ${sp.debtName} min=${sp.minimum} extra=${sp.extra} total=${sp.total}`);
    }
  }

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

  // Start with debts from the balancer
  const enrichedDebts = period.debts.map(d => {
    const src = debts.find(o => o.name === d.name);
    const se = periodSnowball?.snowballPayments.find(s => s.debtId === d.debtId);
    return {
      ...d, minimum_payment: d.amount,
      remaining_amount: d.remaining || src?.remaining_amount || 0,
      interest_rate: d.interestRate || src?.interest_rate || 0,
      snowballExtra: se?.extra ?? 0, snowballTotal: se?.total ?? d.amount,
      remainingAfterSnowball: se?.remainingAfter ?? (d.remaining || src?.remaining_amount || 0),
      paymentUrl: d.paymentUrl || src?.payment_url || null
    };
  });

  // Add any debts that have snowball payments but aren't in the balancer's allocation
  // (e.g. snowball extra targeting a debt with no minimum due this period)
  if (periodSnowball?.snowballPayments) {
    for (const sp of periodSnowball.snowballPayments) {
      const alreadyListed = enrichedDebts.find(d => d.debtId === sp.debtId || d.name === sp.debtName);
      if (!alreadyListed && sp.total > 0) {
        const src = debts.find(o => o.id === sp.debtId || o.name === sp.debtName);
        enrichedDebts.push({
          id: src?.id || sp.debtId,
          debtId: sp.debtId,
          name: sp.debtName,
          amount: 0,
          minimum_payment: 0,
          dueDate: null,
          frequency: 'snowball',
          paidEarly: false,
          autoPay: false,
          isVariable: false,
          remaining_amount: src?.remaining_amount || 0,
          interest_rate: src?.interest_rate || 0,
          snowballExtra: sp.extra,
          snowballTotal: sp.total,
          remainingAfterSnowball: sp.remainingAfter,
          paymentUrl: src?.payment_url || null,
          snowballOnly: true
        });
      }
    }
  }

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
