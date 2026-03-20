const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { round2, calculatePayDates, buildPeriodShells, generateObligations,
        balanceAllocations, computeSnowball, getBillsWithSubscriptions } = require('../engine');

/**
 * GET /api/review?year=2026
 * Returns a year-end review with per-paycheck breakdowns and annual totals.
 */
router.get('/', (req, res) => {
  const db = getDb();
  const config = db.prepare('SELECT * FROM paycheck_config ORDER BY created_at DESC LIMIT 1').get();
  if (!config) return res.json({ configured: false });

  const requestedYear = parseInt(req.query.year) || new Date().getFullYear();

  const bills = getBillsWithSubscriptions();
  const debts = db.prepare('SELECT * FROM debts').all();
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

  // Build per-paycheck breakdown, applying amount overrides for variable bills
  const paycheckBreakdowns = balanced.map((p, i) => {
    const sa = snowball.periodAllocations[i];

    // Fetch amount overrides for this period
    const overrideRows = db.prepare('SELECT * FROM period_amount_overrides WHERE pay_date = ?').all(p.payDate);
    const overrideMap = {};
    for (const o of overrideRows) {
      overrideMap[`${o.item_type}:${o.item_id}`] = o.amount;
    }

    // Apply overrides to bill items and compute actual bill total
    const billItems = p.bills.map(b => {
      const key = `bill:${b.id || b.name}`;
      const actualAmount = overrideMap[key] !== undefined ? overrideMap[key] : b.amount;
      return { ...b, estimateAmount: b.amount, actualAmount };
    });
    const actualBillTotal = round2(billItems.reduce((s, b) => s + b.actualAmount, 0));

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
    const actualDebtMins = sa ? round2(sa.snowballPayments.reduce((s, sp) => s + sp.minimum, 0)) : p.totalDebtMins;

    return {
      payDate: p.payDate,
      income: config.amount,
      bills: actualBillTotal,
      billsEstimate: p.totalBills,
      debtMinimums: actualDebtMins,
      snowballExtra: snowballExtra,
      totalDebtPayments: totalSnowball,
      transfer: p.transfer,
      expenses: round2(expData.total),
      expenseCount: expData.count,
      actualDebtPayments: round2(debtPayData.total),
      billItems: billItems,
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

  // Per-bill annual totals (using actual amounts where overrides exist)
  const billTotals = {};
  for (const p of paycheckBreakdowns) {
    for (const b of p.billItems) {
      if (!billTotals[b.name]) billTotals[b.name] = { name: b.name, total: 0, estimate: 0, count: 0, isVariable: b.isVariable || false };
      billTotals[b.name].total = round2(billTotals[b.name].total + b.actualAmount);
      billTotals[b.name].estimate = round2(billTotals[b.name].estimate + b.estimateAmount);
      billTotals[b.name].count++;
    }
  }

  // Per-debt annual totals — use snowball payments which correctly account for payoff
  // The snowball stops paying minimums after a debt is paid off, so these totals are accurate
  const debtTotals = {};
  for (const sa of snowball.periodAllocations) {
    for (const sp of sa.snowballPayments) {
      if (!debtTotals[sp.debtName]) {
        debtTotals[sp.debtName] = { name: sp.debtName, minimums: 0, extra: 0, totalPlanned: 0, count: 0 };
      }
      debtTotals[sp.debtName].minimums = round2(debtTotals[sp.debtName].minimums + sp.minimum);
      debtTotals[sp.debtName].extra = round2(debtTotals[sp.debtName].extra + sp.extra);
      debtTotals[sp.debtName].totalPlanned = round2(debtTotals[sp.debtName].totalPlanned + sp.total);
      if (sp.total > 0) debtTotals[sp.debtName].count++;
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

// CSV export of year review data
router.get('/csv', (req, res) => {
  try {
    const db = getDb();
    const config = db.prepare('SELECT * FROM paycheck_config ORDER BY created_at DESC LIMIT 1').get();
    if (!config) return res.status(400).json({ error: 'Not configured' });

    const requestedYear = parseInt(req.query.year) || new Date().getFullYear();
    const allPayDates = calculatePayDates(config.start_date, 260);
    const yearStart = `${requestedYear}-01-01`;
    const yearEnd = `${requestedYear}-12-31`;
    const yearPayDates = allPayDates.filter(d => d >= yearStart && d <= yearEnd);

    if (yearPayDates.length === 0) return res.status(404).json({ error: 'No data for year' });

    const bills = getBillsWithSubscriptions();
    const activeDebts = db.prepare('SELECT * FROM debts WHERE is_active = 1').all();
    const shells = buildPeriodShells(yearPayDates, config);
    const obligations = generateObligations(bills, activeDebts, shells);
    const balanced = balanceAllocations(obligations, shells, config);
    for (const p of balanced) { p.totalBills = round2(p.totalBills); p.totalDebtMins = round2(p.totalDebtMins); }
    const snowball = computeSnowball(balanced, activeDebts, config);

    const rows = [['Pay Date', 'Income', 'Bills', 'Debt Minimums', 'Snowball Extra', 'Total Debt', 'Transfer', 'Expenses']];

    balanced.forEach((p, i) => {
      const sa = snowball.periodAllocations[i];
      const expData = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date >= ? AND date < ?').get(p.periodStart, p.periodEnd);
      rows.push([
        p.payDate,
        config.amount.toFixed(2),
        p.totalBills.toFixed(2),
        p.totalDebtMins.toFixed(2),
        (sa?.snowballExtra || 0).toFixed(2),
        (sa?.totalSnowball || p.totalDebtMins).toFixed(2),
        p.transfer.toFixed(2),
        round2(expData.total).toFixed(2)
      ]);
    });

    const csv = rows.map(r => r.join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="paypulse-${requestedYear}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('GET /api/review/csv error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
