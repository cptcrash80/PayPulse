const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid');
const { runFullSnowball, projectSnowballPayoff } = require('../engine');

router.get('/', (req, res) => {
  const db = getDb();
  const debts = db.prepare('SELECT * FROM debts ORDER BY priority DESC, interest_rate DESC').all();
  const paymentStmt = db.prepare('SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY date DESC');

  // Run snowball projection for payoff estimates
  const config = db.prepare('SELECT * FROM paycheck_config ORDER BY created_at DESC LIMIT 1').get();
  let payoffMap = {};
  if (config) {
    const bills = db.prepare('SELECT * FROM recurring_bills WHERE is_active = 1').all();
    const activeDebts = db.prepare('SELECT * FROM debts WHERE is_active = 1').all();
    // Get balanced periods for average calculation, then project
    const { balancedPeriods } = runFullSnowball(config, bills, activeDebts, 6);
    const projection = projectSnowballPayoff(balancedPeriods, activeDebts, config);
    for (const d of projection.debtPayoffOrder) {
      payoffMap[d.id] = {
        payoffPeriod: d.payoffPeriod,
        paidOff: d.paidOff,
        snowballRemaining: d.remaining
      };
    }
  }

  const result = debts.map(d => ({
    ...d,
    payments: paymentStmt.all(d.id),
    snowballEstimate: payoffMap[d.id] || null
  }));

  res.json(result);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, total_amount, remaining_amount, minimum_payment, interest_rate, due_day, priority } = req.body;
  const id = uuidv4();
  db.prepare(
    'INSERT INTO debts (id, name, total_amount, remaining_amount, minimum_payment, interest_rate, due_day, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, name, total_amount, remaining_amount ?? total_amount, minimum_payment || 0, interest_rate || 0, due_day || null, priority || 0);
  const debt = db.prepare('SELECT * FROM debts WHERE id = ?').get(id);
  res.json({ ...debt, payments: [], snowballEstimate: null });
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { name, total_amount, remaining_amount, minimum_payment, interest_rate, due_day, priority, is_active } = req.body;
  db.prepare(
    'UPDATE debts SET name=?, total_amount=?, remaining_amount=?, minimum_payment=?, interest_rate=?, due_day=?, priority=?, is_active=?, updated_at=datetime("now") WHERE id=?'
  ).run(name, total_amount, remaining_amount, minimum_payment, interest_rate, due_day || null, priority || 0, is_active ? 1 : 0, req.params.id);
  const debt = db.prepare('SELECT * FROM debts WHERE id = ?').get(req.params.id);
  const payments = db.prepare('SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY date DESC').all(req.params.id);
  res.json({ ...debt, payments, snowballEstimate: null });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM debts WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.post('/:id/payments', (req, res) => {
  const db = getDb();
  const { amount, date, notes } = req.body;
  const payId = uuidv4();
  db.prepare(
    'INSERT INTO debt_payments (id, debt_id, amount, date, notes) VALUES (?, ?, ?, ?, ?)'
  ).run(payId, req.params.id, amount, date, notes || null);
  db.prepare(
    'UPDATE debts SET remaining_amount = MAX(0, remaining_amount - ?), updated_at = datetime("now") WHERE id = ?'
  ).run(amount, req.params.id);
  const debt = db.prepare('SELECT * FROM debts WHERE id = ?').get(req.params.id);
  const payments = db.prepare('SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY date DESC').all(req.params.id);
  res.json({ ...debt, payments, snowballEstimate: null });
});

module.exports = router;
