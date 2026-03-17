const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { round2, calculatePayDates, buildPeriodShells, generateObligations,
        balanceAllocations, computeSnowball } = require('../engine');

/**
 * GET /api/review?year=2026
 * Returns a year-end review with per-paycheck breakdowns and annual totals.
 */
router.get('/', (req, res) => {
  const db = getDb();
  const config = db.prepare('SELECT * FROM paycheck_config ORDER BY created_at DESC LIMIT 1').get();
  if (!config) return res.json({ configured: false });

  const requestedYear = parseInt(req.query.year) || new Date().getFullYear();

  const bills = db.prepare('SELECT * FROM recurring_bills WHERE is_active = 1').all();
  const debts = db.prepare('SELECT * FROM debts').all(); // all debts, active or not
  const activeDebts = debts.filter(d => d.is_active);

  // Generate pay dates covering the full requested year
  // We need enough periods to span Jan 1 through Dec 31
  const allPayDates = calculatePayDates(config.start_date, 260);
  const yearStart = `${requestedYear}-01-01`;
  const yearEnd = `${requestedYear}-12-31`;

  // Filter to pay dates that fall within the requested year
  const yearPayDates = allPayDates.filter(d => d >= yearStart && d <= yearEnd);

  if (yearPayDates.length === 0) {
    return res.json({
      configured: true,
      year: requestedYear,
      noData: true,
      message: `No pay periods found for ${requestedYear}`
    });
  }

  // Build balanced periods for this year's pay dates
  const shells = buildPeriodShells(yearPayDates, config);
  const obligations = generateObligations(bills, activeDebts, shells);
  const balanced = balanceAllocations(obligations, shells, config);

  for (const p of balanced) {
    p.totalBills = round2(p.totalBills);
    p.totalDebtMins = round2(p.totalDebtMins);
  }

  // Run snowball over these periods
  const snowball = computeSnowball(balanced, activeDebts, config);

  // Build per-paycheck breakdown
  const paycheckBreakdowns = balanced.map((p, i) => {
    const sa = snowball.periodAllocations[i];

    // Actual expenses recorded in this period
    const expData = db.prepare(
      'SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM expenses WHERE date >= ? AND date < ?'
    ).get(p.periodStart, p.periodEnd);

    // Actual debt payments made in this period
    const debtPayData = db.prepare(
      'SELECT COALESCE(SUM(amount), 0) as total FROM debt_payments WHERE date >= ? AND date < ?'
    ).get(p.periodStart, p.periodEnd);

    const totalSnowball = sa ? sa.totalSnowball : p.totalDebtMins;
    const snowballExtra = sa ? sa.snowballExtra : 0;

    return {
      payDate: p.payDate,
      income: config.amount,
      bills: p.totalBills,
      debtMinimums: p.totalDebtMins,
      snowballExtra: snowballExtra,
      totalDebtPayments: totalSnowball,
      transfer: p.transfer,
      expenses: round2(expData.total),
      expenseCount: expData.count,
      actualDebtPayments: round2(debtPayData.total),
      billItems: p.bills,
      debtItems: p.debts
    };
  });

  // Annual totals
  const totalIncome = round2(paycheckBreakdowns.length * config.amount);
  const totalBills = round2(paycheckBreakdowns.reduce((s, p) => s + p.bills, 0));
  const totalDebtPayments = round2(paycheckBreakdowns.reduce((s, p) => s + p.totalDebtPayments, 0));
  const totalSnowballExtra = round2(paycheckBreakdowns.reduce((s, p) => s + p.snowballExtra, 0));
  const totalTransfers = round2(paycheckBreakdowns.reduce((s, p) => s + p.transfer, 0));
  const totalExpenses = round2(paycheckBreakdowns.reduce((s, p) => s + p.expenses, 0));
  const totalActualDebtPayments = round2(
    db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM debt_payments WHERE date >= ? AND date <= ?')
      .get(yearStart, yearEnd).total
  );

  // Per-bill annual totals
  const billTotals = {};
  for (const p of paycheckBreakdowns) {
    for (const b of p.billItems) {
      if (!billTotals[b.name]) billTotals[b.name] = { name: b.name, total: 0, count: 0 };
      billTotals[b.name].total = round2(billTotals[b.name].total + b.amount);
      billTotals[b.name].count++;
    }
  }

  // Per-debt annual totals (planned from snowball)
  const debtTotals = {};
  for (const p of paycheckBreakdowns) {
    for (const d of p.debtItems) {
      if (!debtTotals[d.name]) debtTotals[d.name] = { name: d.name, minimums: 0, count: 0 };
      debtTotals[d.name].minimums = round2(debtTotals[d.name].minimums + d.amount);
      debtTotals[d.name].count++;
    }
  }
  // Add snowball extras per debt
  for (const sa of snowball.periodAllocations) {
    for (const sp of sa.snowballPayments) {
      if (!debtTotals[sp.debtName]) debtTotals[sp.debtName] = { name: sp.debtName, minimums: 0, count: 0 };
      debtTotals[sp.debtName].extra = round2((debtTotals[sp.debtName].extra || 0) + sp.extra);
      debtTotals[sp.debtName].totalPlanned = round2(
        debtTotals[sp.debtName].minimums + (debtTotals[sp.debtName].extra || 0)
      );
    }
  }

  // Actual payments made per debt this year
  const actualByDebt = db.prepare(`
    SELECT d.name, d.id, COALESCE(SUM(dp.amount), 0) as total
    FROM debts d LEFT JOIN debt_payments dp ON d.id = dp.debt_id AND dp.date >= ? AND dp.date <= ?
    GROUP BY d.id
  `).all(yearStart, yearEnd);
  for (const a of actualByDebt) {
    if (debtTotals[a.name]) debtTotals[a.name].actualPaid = round2(a.total);
    else if (a.total > 0) debtTotals[a.name] = { name: a.name, minimums: 0, count: 0, extra: 0, totalPlanned: 0, actualPaid: round2(a.total) };
  }

  // Expense totals by category
  const expensesByCategory = db.prepare(`
    SELECT c.name as category, c.icon, c.color, COALESCE(SUM(e.amount), 0) as total, COUNT(*) as count
    FROM expenses e LEFT JOIN categories c ON e.category_id = c.id
    WHERE e.date >= ? AND e.date <= ?
    GROUP BY e.category_id ORDER BY total DESC
  `).all(yearStart, yearEnd);

  // Available years (for year selector)
  const earliestExpense = db.prepare('SELECT MIN(date) as d FROM expenses').get();
  const earliestPayment = db.prepare('SELECT MIN(date) as d FROM debt_payments').get();
  const earliest = [earliestExpense?.d, earliestPayment?.d, yearStart].filter(Boolean).sort()[0];
  const startYear = new Date(earliest).getFullYear();
  const currentYear = new Date().getFullYear();
  const availableYears = [];
  for (let y = startYear; y <= currentYear + 1; y++) availableYears.push(y);

  res.json({
    configured: true,
    year: requestedYear,
    availableYears,
    payPeriods: paycheckBreakdowns.length,
    summary: {
      totalIncome,
      totalBills,
      totalDebtPayments,
      totalSnowballExtra,
      totalTransfers,
      totalExpenses,
      totalActualDebtPayments,
      netRemaining: round2(totalIncome - totalBills - totalDebtPayments - totalTransfers - totalExpenses)
    },
    billTotals: Object.values(billTotals).sort((a, b) => b.total - a.total),
    debtTotals: Object.values(debtTotals).sort((a, b) => (b.totalPlanned || 0) - (a.totalPlanned || 0)),
    expensesByCategory,
    paycheckBreakdowns
  });
});

module.exports = router;
