const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { round2, calculatePayDates, buildPeriodShells, generateObligations,
        balanceAllocations, computeSnowball, getBillsWithSubscriptions } = require('../engine');

/**
 * GET /api/progress
 * Returns debt paydown and savings accumulation data over time for charting.
 */
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const config = db.prepare('SELECT * FROM paycheck_config ORDER BY created_at DESC LIMIT 1').get();
    if (!config) return res.json({ configured: false });

    const debts = db.prepare('SELECT * FROM debts').all();
    const activeDebts = debts.filter(d => d.is_active);
    const bills = getBillsWithSubscriptions();

    // Total original debt
    const totalOriginalDebt = round2(debts.reduce((s, d) => s + d.total_amount, 0));
    const totalCurrentDebt = round2(debts.reduce((s, d) => s + d.remaining_amount, 0));
    const totalPaidOff = round2(totalOriginalDebt - totalCurrentDebt);

    // Get all debt payments ordered by date for the paydown curve
    const payments = db.prepare('SELECT date, amount FROM debt_payments ORDER BY date ASC').all();

    // Build cumulative debt paydown timeline
    let runningDebt = totalOriginalDebt;
    const debtTimeline = [{ date: config.start_date, totalDebt: totalOriginalDebt, totalSaved: 0 }];

    // Group payments by date
    const paymentsByDate = {};
    for (const p of payments) {
      paymentsByDate[p.date] = round2((paymentsByDate[p.date] || 0) + p.amount);
    }
    for (const [date, amount] of Object.entries(paymentsByDate)) {
      runningDebt = round2(runningDebt - amount);
      debtTimeline.push({ date, totalDebt: Math.max(0, runningDebt), totalSaved: 0 });
    }

    // Calculate cumulative savings from transfers
    // Walk through pay periods and accumulate transfer amounts
    const payDates = calculatePayDates(config.start_date, 52); // ~2 years
    const today = new Date().toISOString().split('T')[0];
    let cumulativeSavings = 0;
    const savingsTimeline = [];

    for (const pd of payDates) {
      if (pd > today) break;
      cumulativeSavings = round2(cumulativeSavings + config.transfer_amount);
      savingsTimeline.push({ date: pd, totalSaved: cumulativeSavings });
    }

    // Merge timelines — get all unique dates and interpolate
    const allDates = new Set();
    debtTimeline.forEach(p => allDates.add(p.date));
    savingsTimeline.forEach(p => allDates.add(p.date));
    const sortedDates = [...allDates].sort();

    let lastDebt = totalOriginalDebt;
    let lastSaved = 0;
    const mergedTimeline = [];
    for (const date of sortedDates) {
      const debtEntry = debtTimeline.find(d => d.date === date);
      const savingsEntry = savingsTimeline.find(s => s.date === date);
      if (debtEntry) lastDebt = debtEntry.totalDebt;
      if (savingsEntry) lastSaved = savingsEntry.totalSaved;
      mergedTimeline.push({
        date,
        totalDebt: lastDebt,
        totalSaved: lastSaved,
        netWorth: round2(lastSaved - lastDebt)
      });
    }

    // Project future with snowball
    const shells = buildPeriodShells(calculatePayDates(config.start_date, 6), config);
    const obligations = generateObligations(bills, activeDebts, shells);
    const balanced = balanceAllocations(obligations, shells, config);
    for (const p of balanced) { p.totalBills = round2(p.totalBills); p.totalDebtMins = round2(p.totalDebtMins); }
    const snowball = computeSnowball(balanced, activeDebts, config);

    const avgSnowballPerPeriod = snowball.periodAllocations.length > 0
      ? round2(snowball.periodAllocations.reduce((s, a) => s + a.totalSnowball, 0) / snowball.periodAllocations.length)
      : 0;

    // Project 26 periods into future
    const projections = [];
    let projDebt = totalCurrentDebt;
    let projSaved = cumulativeSavings;
    const futurePayDates = calculatePayDates(config.start_date, 26);
    for (const pd of futurePayDates) {
      if (pd <= today) continue;
      projDebt = round2(Math.max(0, projDebt - avgSnowballPerPeriod));
      projSaved = round2(projSaved + config.transfer_amount);
      projections.push({
        date: pd,
        totalDebt: projDebt,
        totalSaved: projSaved,
        netWorth: round2(projSaved - projDebt),
        projected: true
      });
    }

    res.json({
      configured: true,
      summary: {
        totalOriginalDebt,
        totalCurrentDebt,
        totalPaidOff,
        percentPaid: totalOriginalDebt > 0 ? round2((totalPaidOff / totalOriginalDebt) * 100) : 0,
        totalSaved: cumulativeSavings,
        currentNetWorth: round2(cumulativeSavings - totalCurrentDebt),
        avgSnowballPerPeriod
      },
      timeline: mergedTimeline,
      projections
    });
  } catch (err) {
    console.error('GET /api/progress error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
