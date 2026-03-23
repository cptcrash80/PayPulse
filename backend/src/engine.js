const { getDb } = require('./database');

function round2(n) { return Math.round(n * 100) / 100; }

function getMonthsInRange(start, end) {
  const months = [], seen = new Set();
  for (const d of [start, end]) {
    const key = d.getFullYear() + '-' + d.getMonth();
    if (!seen.has(key)) { seen.add(key); months.push({ year: d.getFullYear(), month: d.getMonth() }); }
  }
  return months;
}

function calculatePayDates(startDate, count, pastCount) {
  pastCount = pastCount || 0;
  const dates = [], start = new Date(startDate);
  const today = new Date().toISOString().split('T')[0];
  let current = new Date(start);
  // Advance until current is on or after today
  while (current.toISOString().split('T')[0] < today) current.setDate(current.getDate() + 14);
  // Walk backwards for past periods
  let pastStart = new Date(current);
  for (let i = 0; i < pastCount; i++) {
    pastStart.setDate(pastStart.getDate() - 14);
  }
  let d = new Date(pastStart);
  for (let i = 0; i < count + pastCount; i++) { dates.push(d.toISOString().split('T')[0]); d = new Date(d); d.setDate(d.getDate() + 14); }
  return dates;
}

function getCurrentPayPeriod(payDates) {
  if (payDates.length < 2) return { start: payDates[0], end: payDates[0] };
  const today = new Date().toISOString().split('T')[0];
  // Find the period where today falls between payDate[i] and payDate[i+1]
  for (let i = 0; i < payDates.length - 1; i++) {
    if (today >= payDates[i] && today < payDates[i + 1]) {
      return { start: payDates[i], end: payDates[i + 1] };
    }
  }
  // Fallback: if today is on/after the last date, use the last date
  return { start: payDates[payDates.length - 1], end: payDates[payDates.length - 1] };
}

function buildPeriodShells(payDates, config) {
  return payDates.map((date, i) => {
    const periodStart = new Date(date);
    const periodEnd = i < payDates.length - 1 ? new Date(payDates[i + 1]) : new Date(periodStart);
    if (i === payDates.length - 1) periodEnd.setDate(periodEnd.getDate() + 14);
    return {
      payDate: date, periodStart: periodStart.toISOString().split('T')[0],
      periodEnd: periodEnd.toISOString().split('T')[0],
      bills: [], debts: [], totalBills: 0, totalDebtMins: 0,
      totalExpenses: 0, transfer: config.transfer_amount,
      committed: 0, available: 0
    };
  });
}

// ════════════════════════════════════════════════════════════════════
//  OBLIGATION GENERATION
// ════════════════════════════════════════════════════════════════════

function generateObligations(bills, debts, periods) {
  const items = [];
  for (const bill of bills) {
    if (bill.frequency === 'biweekly') {
      for (let pi = 0; pi < periods.length; pi++)
        items.push({ name: bill.name, amount: bill.amount, type: 'bill', frequency: 'biweekly', dueDate: periods[pi].payDate, deadlinePeriodIdx: pi, earliestPeriodIdx: pi, moveable: false, data: bill });
    } else if (bill.frequency === 'weekly') {
      for (let pi = 0; pi < periods.length; pi++)
        items.push({ name: bill.name + ' (x2)', amount: bill.amount * 2, type: 'bill', frequency: 'weekly', dueDate: periods[pi].payDate, deadlinePeriodIdx: pi, earliestPeriodIdx: pi, moveable: false, data: bill });
    } else if (bill.frequency === 'monthly') {
      const isAutoPay = bill.auto_pay ? true : false;
      for (let pi = 0; pi < periods.length; pi++) {
        const pStart = new Date(periods[pi].periodStart), pEnd = new Date(periods[pi].periodEnd);
        for (const { year, month } of getMonthsInRange(pStart, pEnd)) {
          const dueDate = new Date(year, month, bill.due_day);
          if (dueDate >= pStart && dueDate < pEnd)
            items.push({ name: bill.name, amount: bill.amount, type: 'bill', frequency: 'monthly', dueDate: dueDate.toISOString().split('T')[0], deadlinePeriodIdx: pi, earliestPeriodIdx: isAutoPay ? pi : Math.max(0, pi - 1), moveable: !isAutoPay, autoPay: isAutoPay, data: bill });
        }
      }
    }
  }
  for (const debt of debts) {
    if (debt.minimum_payment <= 0) continue;
    if (debt.due_day) {
      const isAutoPay = debt.auto_pay ? true : false;
      for (let pi = 0; pi < periods.length; pi++) {
        const pStart = new Date(periods[pi].periodStart), pEnd = new Date(periods[pi].periodEnd);
        for (const { year, month } of getMonthsInRange(pStart, pEnd)) {
          const dueDate = new Date(year, month, debt.due_day);
          if (dueDate >= pStart && dueDate < pEnd)
            items.push({ name: debt.name, amount: debt.minimum_payment, type: 'debt', frequency: 'monthly', dueDate: dueDate.toISOString().split('T')[0], deadlinePeriodIdx: pi, earliestPeriodIdx: isAutoPay ? pi : Math.max(0, pi - 1), moveable: !isAutoPay, autoPay: isAutoPay, debtId: debt.id, remaining: debt.remaining_amount, interestRate: debt.interest_rate, data: debt });
        }
      }
    } else {
      for (let pi = 0; pi < periods.length; pi++)
        items.push({ name: debt.name, amount: debt.minimum_payment, type: 'debt', frequency: 'ongoing', dueDate: null, deadlinePeriodIdx: pi, earliestPeriodIdx: pi, moveable: false, debtId: debt.id, remaining: debt.remaining_amount, interestRate: debt.interest_rate, data: debt });
    }
  }
  return items;
}

// ════════════════════════════════════════════════════════════════════
//  BALANCING ENGINE
// ════════════════════════════════════════════════════════════════════

function balanceAllocations(items, periods, config) {
  const assignments = items.map(item => ({ ...item, assignedPeriodIdx: item.deadlinePeriodIdx }));
  function getLoads() {
    const loads = periods.map(() => config.transfer_amount);
    for (const a of assignments) loads[a.assignedPeriodIdx] += a.amount;
    return loads;
  }
  for (let iter = 0; iter < 100; iter++) {
    const loads = getLoads();
    let maxLoad = -Infinity, maxIdx = -1;
    for (let i = 0; i < loads.length; i++) { if (loads[i] > maxLoad) { maxLoad = loads[i]; maxIdx = i; } }
    let moved = false;
    const moveableInMax = assignments
      .filter(a => a.assignedPeriodIdx === maxIdx && a.moveable && a.earliestPeriodIdx < maxIdx)
      .sort((a, b) => b.amount - a.amount);
    for (const item of moveableInMax) {
      for (let t = maxIdx - 1; t >= item.earliestPeriodIdx; t--) {
        if (loads[t] + item.amount < maxLoad) { item.assignedPeriodIdx = t; moved = true; break; }
      }
      if (moved) break;
    }
    if (!moved) break;
  }
  for (const p of periods) { p.bills = []; p.debts = []; p.totalBills = 0; p.totalDebtMins = 0; }
  for (const a of assignments) {
    const p = periods[a.assignedPeriodIdx];
    const entry = { id: a.data?.id || null, name: a.name, amount: a.amount, dueDate: a.dueDate, frequency: a.frequency, paidEarly: a.assignedPeriodIdx < a.deadlinePeriodIdx, autoPay: a.autoPay || false, paymentUrl: a.data?.payment_url || null, isVariable: a.data?.is_variable ? true : false };
    if (a.type === 'bill') { p.bills.push(entry); p.totalBills += a.amount; }
    else { p.debts.push({ ...entry, remaining: a.remaining, interestRate: a.interestRate, debtId: a.debtId }); p.totalDebtMins += a.amount; }
  }
  return periods;
}

// ════════════════════════════════════════════════════════════════════
//  SNOWBALL ENGINE (short-term, per-period detail)
//  Runs over the provided balanced periods for display purposes.
// ════════════════════════════════════════════════════════════════════

function computeSnowball(periods, debts, config) {
  const db = getDb();

  // Load all snowball overrides into a map
  const snowballOverrides = {};
  try {
    const rows = db.prepare('SELECT * FROM period_snowball_overrides').all();
    for (const r of rows) snowballOverrides[r.pay_date] = r;
  } catch (e) {
    // Table might not exist yet on first run
  }

  const debtStates = debts
    .filter(d => d.is_active && d.remaining_amount > 0)
    .map(d => ({ id: d.id, name: d.name, originalBalance: d.remaining_amount, remaining: d.remaining_amount, minimumPayment: d.minimum_payment, interestRate: d.interest_rate, paidOff: false, payoffPeriod: null, payoffDate: null }))
    .sort((a, b) => a.remaining - b.remaining);

  const periodAllocations = [];
  const paidOffIds = new Set();

  // Find the current period index — snowball extra only applies from here onward
  const today = new Date().toISOString().split('T')[0];
  let currentPeriodIdx = 0;
  for (let i = 0; i < periods.length; i++) {
    if (periods[i].payDate <= today && (i === periods.length - 1 || periods[i + 1].payDate > today)) {
      currentPeriodIdx = i;
      break;
    }
  }

  for (let pi = 0; pi < periods.length; pi++) {
    const period = periods[pi];
    const isPastPeriod = pi < currentPeriodIdx;
    let freeCash = config.amount - period.totalBills - period.transfer;
    let activeMinimums = 0;
    for (const pd of period.debts) {
      if (!paidOffIds.has(pd.debtId)) activeMinimums += pd.amount;
    }
    freeCash -= activeMinimums;
    freeCash = round2(freeCash);

    const minSpending = config.minimum_spending || 0;
    const payments = [];
    // No snowball extra for past periods — those are historical
    let extraPool = isPastPeriod ? 0 : round2(Math.max(0, freeCash - minSpending));

    // Apply snowball override for this period
    const override = snowballOverrides[period.payDate];
    let snowballSkipped = false;
    let snowballCapped = false;
    if (override && override.max_extra !== null && override.max_extra !== undefined) {
      if (override.max_extra === 0) {
        extraPool = 0;
        snowballSkipped = true;
      } else {
        extraPool = round2(Math.min(extraPool, override.max_extra));
        snowballCapped = true;
      }
    }

    for (const ds of debtStates) {
      if (ds.paidOff) continue;
      const periodDebt = period.debts.find(d => d.debtId === ds.id);
      if (!periodDebt || paidOffIds.has(ds.id)) continue;
      const minPay = round2(Math.min(periodDebt.amount, ds.remaining));
      if (minPay <= 0) continue;
      ds.remaining = round2(ds.remaining - minPay);
      payments.push({ debtId: ds.id, debtName: ds.name, minimum: minPay, extra: 0, total: minPay, remainingAfter: ds.remaining });
      if (ds.remaining <= 0) { ds.paidOff = true; ds.payoffPeriod = period.payDate; ds.payoffDate = period.periodEnd; paidOffIds.add(ds.id); }
    }

    for (const ds of debtStates) {
      if (ds.paidOff || extraPool <= 0) continue;
      const extraPayment = round2(Math.min(extraPool, ds.remaining));
      if (extraPayment <= 0) continue;
      ds.remaining = round2(ds.remaining - extraPayment);
      extraPool = round2(extraPool - extraPayment);
      const existing = payments.find(p => p.debtId === ds.id);
      if (existing) { existing.extra = round2(existing.extra + extraPayment); existing.total = round2(existing.minimum + existing.extra); existing.remainingAfter = ds.remaining; }
      else { payments.push({ debtId: ds.id, debtName: ds.name, minimum: 0, extra: extraPayment, total: extraPayment, remainingAfter: ds.remaining }); }
      if (ds.remaining <= 0) { ds.paidOff = true; ds.payoffPeriod = period.payDate; ds.payoffDate = period.periodEnd; paidOffIds.add(ds.id); continue; }
      break;
    }

    const totalSnowball = round2(payments.reduce((s, p) => s + p.total, 0));
    const snowballExtra = round2(payments.reduce((s, p) => s + p.extra, 0));

    periodAllocations.push({
      payDate: period.payDate, snowballPayments: payments, totalSnowball, snowballExtra,
      freeCash, minimumSpending: minSpending,
      remainingAfterSnowball: round2(config.amount - period.totalBills - period.transfer - totalSnowball),
      snowballTarget: debtStates.find(d => !d.paidOff)?.name || null,
      snowballSkipped,
      snowballCapped,
      snowballOverride: override ? override.max_extra : null,
      snowballOverrideNotes: override?.notes || null
    });
  }

  return { periodAllocations, debtStates };
}

// ════════════════════════════════════════════════════════════════════
//  SNOWBALL PROJECTION (long-term payoff date estimation)
//  Uses average free cash per period from balanced periods and
//  simulates forward pay-period by pay-period for up to 10 years.
//  This avoids the "empty period" bug where periods without
//  obligations appear to have the full paycheck as free cash.
// ════════════════════════════════════════════════════════════════════

function projectSnowballPayoff(balancedPeriods, debts, config) {
  const activeDebts = debts.filter(d => d.is_active && d.remaining_amount > 0);
  if (activeDebts.length === 0) {
    return { debtPayoffOrder: [], estimatedPeriodsToDebtFree: 0, allPaidInWindow: true };
  }

  // Compute average obligations per period from the balanced set.
  // The balanced periods have correct allocations, so averaging them
  // gives us realistic per-period costs.
  const numPeriods = balancedPeriods.length;
  const avgBillsPerPeriod = balancedPeriods.reduce((s, p) => s + p.totalBills, 0) / numPeriods;
  const avgDebtMinsPerPeriod = balancedPeriods.reduce((s, p) => s + p.totalDebtMins, 0) / numPeriods;

  // Average free cash per period AFTER bills, debt mins, and transfer
  const avgFreeCash = round2(config.amount - avgBillsPerPeriod - avgDebtMinsPerPeriod - config.transfer_amount);
  const minSpending = config.minimum_spending || 0;
  const avgExtraPerPeriod = round2(Math.max(0, avgFreeCash - minSpending));

  // For each debt, compute its average minimum payment per period.
  // Monthly debts pay once per ~2.17 periods, so per-period average = min / 2.17
  // Debts with no due_day (ongoing) pay every period.
  // We get this from the balanced periods directly.
  const debtMinPerPeriod = {};
  for (const d of activeDebts) {
    // Count how many of the 6 balanced periods include this debt
    let totalAllocated = 0;
    for (const p of balancedPeriods) {
      const pd = p.debts.find(x => x.debtId === d.id);
      if (pd) totalAllocated += pd.amount;
    }
    debtMinPerPeriod[d.id] = totalAllocated / numPeriods;
  }

  // Sort by remaining ascending (snowball order)
  const debtStates = activeDebts
    .map(d => ({
      id: d.id, name: d.name, originalBalance: d.remaining_amount,
      remaining: d.remaining_amount,
      avgMinPerPeriod: debtMinPerPeriod[d.id] || 0,
      paidOff: false, payoffPeriod: null
    }))
    .sort((a, b) => a.remaining - b.remaining);

  // Generate pay dates for projection (10 years)
  const projPayDates = calculatePayDates(config.start_date, 260);
  const paidOffIds = new Set();

  for (let pi = 0; pi < projPayDates.length; pi++) {
    const payDate = projPayDates[pi];
    if (debtStates.every(d => d.paidOff)) break;

    // Pay average minimums on active debts
    for (const ds of debtStates) {
      if (ds.paidOff) continue;
      const minPay = round2(Math.min(ds.avgMinPerPeriod, ds.remaining));
      if (minPay <= 0) continue;
      ds.remaining = round2(ds.remaining - minPay);
      if (ds.remaining <= 0) {
        ds.paidOff = true;
        ds.payoffPeriod = payDate;
        paidOffIds.add(ds.id);
      }
    }

    // Freed minimums from paid-off debts roll into extra
    let freedMins = 0;
    for (const ds of debtStates) {
      if (paidOffIds.has(ds.id) && ds.payoffPeriod !== payDate) {
        freedMins += ds.avgMinPerPeriod;
      }
    }

    // Apply extra (avg free cash + freed mins) to smallest remaining
    let extra = round2(avgExtraPerPeriod + freedMins);
    for (const ds of debtStates) {
      if (ds.paidOff || extra <= 0) continue;
      const payment = round2(Math.min(extra, ds.remaining));
      ds.remaining = round2(ds.remaining - payment);
      extra = round2(extra - payment);
      if (ds.remaining <= 0) {
        ds.paidOff = true;
        ds.payoffPeriod = payDate;
        paidOffIds.add(ds.id);
        continue;
      }
      break;
    }
  }

  const debtPayoffOrder = debtStates.map(ds => ({
    id: ds.id, name: ds.name, originalBalance: ds.originalBalance,
    remaining: ds.remaining, paidOff: ds.paidOff, payoffPeriod: ds.payoffPeriod
  }));

  const allPaidOff = debtStates.every(d => d.paidOff);
  let estimatedPeriodsToDebtFree = null;
  if (allPaidOff) {
    const lastPayoff = debtStates.reduce((max, d) => {
      const idx = projPayDates.indexOf(d.payoffPeriod);
      return Math.max(max, idx + 1);
    }, 0);
    estimatedPeriodsToDebtFree = lastPayoff;
  }

  return { debtPayoffOrder, estimatedPeriodsToDebtFree, allPaidInWindow: allPaidOff };
}


// ════════════════════════════════════════════════════════════════════
//  HIGH-LEVEL RUNNERS
// ════════════════════════════════════════════════════════════════════

/**
 * Run balance + short-term snowball over periodCount periods.
 */
function runFullSnowball(config, bills, debts, periodCount, pastCount) {
  const payDates = calculatePayDates(config.start_date, periodCount, pastCount || 0);
  const shells = buildPeriodShells(payDates, config);
  const obligations = generateObligations(bills, debts, shells);
  const balanced = balanceAllocations(obligations, shells, config);

  const db = getDb();
  for (const p of balanced) {
    const exps = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date >= ? AND date < ?').get(p.periodStart, p.periodEnd);
    p.totalExpenses = round2(exps.total);
    p.totalBills = round2(p.totalBills);
    p.totalDebtMins = round2(p.totalDebtMins);
  }

  const snowball = computeSnowball(balanced, debts, config);
  return { balancedPeriods: balanced, snowball };
}

/**
 * Fetch active bills + active subscriptions merged into one array.
 * Subscriptions are treated as auto_pay bills.
 */
function getBillsWithSubscriptions() {
  const db = getDb();
  const bills = db.prepare('SELECT * FROM recurring_bills WHERE is_active = 1').all();
  const subs = db.prepare('SELECT * FROM subscriptions WHERE is_active = 1').all();
  const merged = [
    ...bills,
    ...subs.map(s => ({
      ...s,
      auto_pay: 1,
      _isSub: true
    }))
  ];
  return merged;
}

module.exports = {
  round2, getMonthsInRange, calculatePayDates, getCurrentPayPeriod,
  buildPeriodShells, generateObligations, balanceAllocations,
  computeSnowball, runFullSnowball, projectSnowballPayoff,
  getBillsWithSubscriptions
};
