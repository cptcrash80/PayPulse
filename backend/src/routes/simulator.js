const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { round2, calculatePayDates, buildPeriodShells, generateObligations,
        balanceAllocations, computeSnowball, projectSnowballPayoff, getBillsWithSubscriptions } = require('../engine');

/**
 * POST /api/simulator
 * Runs the engine with hypothetical adjustments.
 * Body: {
 *   extraDebtPayment: 0,   // additional amount per period toward debt
 *   newBill: { name, amount, due_day, frequency } | null,  // hypothetical new bill
 *   removedBillIds: [],     // bills to remove from simulation
 *   removedDebtIds: [],     // debts to remove from simulation
 *   paycheckOverride: null  // override paycheck amount
 * }
 */
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const config = db.prepare('SELECT * FROM paycheck_config ORDER BY created_at DESC LIMIT 1').get();
    if (!config) return res.json({ error: 'Not configured' });

    const { extraDebtPayment, newBill, removedBillIds, removedDebtIds, paycheckOverride } = req.body;

    // Clone config with optional override
    const simConfig = { ...config };
    if (paycheckOverride && paycheckOverride > 0) simConfig.amount = paycheckOverride;

    // Get bills, optionally add/remove
    let bills = getBillsWithSubscriptions();
    if (removedBillIds?.length) {
      bills = bills.filter(b => !removedBillIds.includes(b.id));
    }
    if (newBill && newBill.name && newBill.amount > 0) {
      bills.push({
        id: '__sim_new_bill__',
        name: newBill.name,
        amount: newBill.amount,
        due_day: newBill.due_day || 1,
        frequency: newBill.frequency || 'monthly',
        is_active: 1,
        auto_pay: 0,
        is_variable: 0
      });
    }

    // Get debts, optionally remove
    let debts = db.prepare('SELECT * FROM debts WHERE is_active = 1').all();
    if (removedDebtIds?.length) {
      debts = debts.filter(d => !removedDebtIds.includes(d.id));
    }

    // If extra debt payment, temporarily reduce minimum_spending to free up cash
    const simConfigAdjusted = { ...simConfig };
    if (extraDebtPayment > 0) {
      simConfigAdjusted.minimum_spending = Math.max(0, (simConfig.minimum_spending || 0) - extraDebtPayment);
    }

    // ── Run baseline (current state) ──
    const baselineBills = getBillsWithSubscriptions();
    const baselineDebts = db.prepare('SELECT * FROM debts WHERE is_active = 1').all();
    const basePayDates = calculatePayDates(config.start_date, 6);
    const baseShells = buildPeriodShells(basePayDates, config);
    const baseObligations = generateObligations(baselineBills, baselineDebts, baseShells);
    const baseBalanced = balanceAllocations(baseObligations, baseShells, config);
    for (const p of baseBalanced) { p.totalBills = round2(p.totalBills); p.totalDebtMins = round2(p.totalDebtMins); }
    const baseProjection = projectSnowballPayoff(baseBalanced, baselineDebts, config);

    // ── Run simulation ──
    const simPayDates = calculatePayDates(simConfig.start_date, 6);
    const simShells = buildPeriodShells(simPayDates, simConfigAdjusted);
    const simObligations = generateObligations(bills, debts, simShells);
    const simBalanced = balanceAllocations(simObligations, simShells, simConfigAdjusted);
    for (const p of simBalanced) { p.totalBills = round2(p.totalBills); p.totalDebtMins = round2(p.totalDebtMins); }
    const simProjection = projectSnowballPayoff(simBalanced, debts, simConfigAdjusted);

    // ── Compare results ──
    const baselineDebtFree = baseProjection.estimatedPeriodsToDebtFree;
    const simDebtFree = simProjection.estimatedPeriodsToDebtFree;

    const baselineMonthlyObligations = round2(baseBalanced.reduce((s, p) => s + p.totalBills + p.totalDebtMins, 0) / baseBalanced.length);
    const simMonthlyObligations = round2(simBalanced.reduce((s, p) => s + p.totalBills + p.totalDebtMins, 0) / simBalanced.length);

    const baseAvgFree = round2(baseBalanced.reduce((s, p) => s + (config.amount - p.totalBills - p.totalDebtMins - config.transfer_amount), 0) / baseBalanced.length);
    const simAvgFree = round2(simBalanced.reduce((s, p) => s + (simConfig.amount - p.totalBills - p.totalDebtMins - simConfig.transfer_amount), 0) / simBalanced.length);

    res.json({
      baseline: {
        periodsToDebtFree: baselineDebtFree,
        allPaidInWindow: baseProjection.allPaidInWindow,
        avgObligationsPerPeriod: baselineMonthlyObligations,
        avgFreePerPeriod: baseAvgFree,
        debtPayoffOrder: baseProjection.debtPayoffOrder.map(d => ({
          name: d.name, remaining: d.remaining, paidOff: d.paidOff, payoffPeriod: d.payoffPeriod
        }))
      },
      simulation: {
        periodsToDebtFree: simDebtFree,
        allPaidInWindow: simProjection.allPaidInWindow,
        avgObligationsPerPeriod: simMonthlyObligations,
        avgFreePerPeriod: simAvgFree,
        debtPayoffOrder: simProjection.debtPayoffOrder.map(d => ({
          name: d.name, remaining: d.remaining, paidOff: d.paidOff, payoffPeriod: d.payoffPeriod
        }))
      },
      comparison: {
        periodsSaved: baselineDebtFree && simDebtFree ? baselineDebtFree - simDebtFree : null,
        obligationChange: round2(simMonthlyObligations - baselineMonthlyObligations),
        freeCashChange: round2(simAvgFree - baseAvgFree)
      }
    });
  } catch (err) {
    console.error('POST /api/simulator error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
