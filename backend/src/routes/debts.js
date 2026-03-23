const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid');
const { runFullSnowball, projectSnowballPayoff, getBillsWithSubscriptions } = require('../engine');

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const debts = db.prepare('SELECT * FROM debts ORDER BY priority DESC, interest_rate DESC').all();
    const paymentStmt = db.prepare('SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY date DESC');

    const config = db.prepare('SELECT * FROM paycheck_config ORDER BY created_at DESC LIMIT 1').get();
    let payoffMap = {};
    if (config) {
      const bills = getBillsWithSubscriptions();
      const activeDebts = db.prepare('SELECT * FROM debts WHERE is_active = 1').all();
      const { balancedPeriods } = runFullSnowball(config, bills, activeDebts, 6);
      const projection = projectSnowballPayoff(balancedPeriods, activeDebts, config);
      for (const d of projection.debtPayoffOrder) {
        payoffMap[d.id] = { payoffPeriod: d.payoffPeriod, paidOff: d.paidOff, snowballRemaining: d.remaining };
      }
    }

    const result = debts.map(d => ({
      ...d,
      payments: paymentStmt.all(d.id),
      snowballEstimate: payoffMap[d.id] || null
    }));
    res.json(result);
  } catch (err) {
    console.error('GET /api/debts error:', err);
    res.status(500).json({ error: err.message, route: 'GET /debts' });
  }
});

router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { name, total_amount, remaining_amount, minimum_payment, interest_rate, due_day, priority, auto_pay, payment_url } = req.body;
    const id = uuidv4();
    db.prepare(
      'INSERT INTO debts (id, name, total_amount, remaining_amount, minimum_payment, interest_rate, due_day, priority, auto_pay, payment_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, name, total_amount, remaining_amount ?? total_amount, minimum_payment || 0, interest_rate || 0, due_day || null, priority || 0, auto_pay ? 1 : 0, payment_url || null);
    const debt = db.prepare('SELECT * FROM debts WHERE id = ?').get(id);
    res.json({ ...debt, payments: [], snowballEstimate: null });
  } catch (err) {
    console.error('POST /api/debts error:', err);
    res.status(500).json({ error: err.message, route: 'POST /debts', body: req.body });
  }
});

router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const body = req.body;

    const name = body.name;
    const total_amount = body.total_amount || 0;
    const remaining_amount = body.remaining_amount ?? 0;
    const minimum_payment = body.minimum_payment || 0;
    const interest_rate = body.interest_rate || 0;
    const due_day = body.due_day || null;
    const priority = body.priority || 0;
    const is_active = body.is_active ? 1 : 0;
    const auto_pay = body.auto_pay ? 1 : 0;
    const payment_url = body.payment_url || null;

    db.prepare(
      `UPDATE debts SET name=?, total_amount=?, remaining_amount=?, minimum_payment=?, interest_rate=?, due_day=?, priority=?, is_active=?, auto_pay=?, payment_url=?, updated_at=datetime('now') WHERE id=?`
    ).run(name, total_amount, remaining_amount, minimum_payment, interest_rate, due_day, priority, is_active, auto_pay, payment_url, req.params.id);

    const debt = db.prepare('SELECT * FROM debts WHERE id = ?').get(req.params.id);
    const payments = db.prepare('SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY date DESC').all(req.params.id);
    res.json({ ...debt, payments, snowballEstimate: null });
  } catch (err) {
    console.error('PUT /api/debts/:id error:', err);
    res.status(500).json({ error: err.message, route: `PUT /debts/${req.params.id}`, body: req.body });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM debts WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/debts/:id error:', err);
    res.status(500).json({ error: err.message, route: `DELETE /debts/${req.params.id}` });
  }
});

router.post('/:id/payments', (req, res) => {
  try {
    const db = getDb();
    const { amount, date, notes } = req.body;
    const payId = uuidv4();
    db.prepare(
      'INSERT INTO debt_payments (id, debt_id, amount, date, notes) VALUES (?, ?, ?, ?, ?)'
    ).run(payId, req.params.id, amount, date, notes || null);
    db.prepare(
      `UPDATE debts SET remaining_amount = MAX(0, remaining_amount - ?), updated_at = datetime('now') WHERE id = ?`
    ).run(amount, req.params.id);
    const debt = db.prepare('SELECT * FROM debts WHERE id = ?').get(req.params.id);
    const payments = db.prepare('SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY date DESC').all(req.params.id);
    res.json({ ...debt, payments, snowballEstimate: null });
  } catch (err) {
    console.error('POST /api/debts/:id/payments error:', err);
    res.status(500).json({ error: err.message, route: `POST /debts/${req.params.id}/payments`, body: req.body });
  }
});

module.exports = router;
