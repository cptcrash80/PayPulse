const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid');

// Get paycheck config
router.get('/', (req, res) => {
  const db = getDb();
  const config = db.prepare('SELECT * FROM paycheck_config ORDER BY created_at DESC LIMIT 1').get();
  if (!config) return res.json(null);

  // Calculate upcoming pay dates (future only)
  const payDates = [];
  const start = new Date(config.start_date);
  const now = new Date();

  // Walk forward from start_date to find the next future payday
  let current = new Date(start);
  while (current <= now) {
    current.setDate(current.getDate() + 14);
  }
  // 'current' is now the next upcoming payday (strictly after today)

  let d = new Date(current);
  for (let i = 0; i < 26; i++) {
    payDates.push(d.toISOString().split('T')[0]);
    d = new Date(d);
    d.setDate(d.getDate() + 14);
  }

  res.json({ ...config, payDates });
});

// Create/update paycheck config
router.post('/', (req, res) => {
  const db = getDb();
  const { amount, start_date, transfer_amount, minimum_spending } = req.body;

  // Upsert - delete old, insert new
  db.prepare('DELETE FROM paycheck_config').run();
  const id = uuidv4();
  db.prepare(
    'INSERT INTO paycheck_config (id, amount, start_date, transfer_amount, minimum_spending) VALUES (?, ?, ?, ?, ?)'
  ).run(id, amount, start_date, transfer_amount || 0, minimum_spending || 0);

  const config = db.prepare('SELECT * FROM paycheck_config WHERE id = ?').get(id);
  res.json(config);
});

// Update transfer amount
router.patch('/transfer', (req, res) => {
  const db = getDb();
  const { transfer_amount } = req.body;
  db.prepare('UPDATE paycheck_config SET transfer_amount = ?, updated_at = datetime("now")').run(transfer_amount);
  const config = db.prepare('SELECT * FROM paycheck_config ORDER BY created_at DESC LIMIT 1').get();
  res.json(config);
});

module.exports = router;
