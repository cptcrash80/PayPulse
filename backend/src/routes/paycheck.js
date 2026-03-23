const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid');

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const config = db.prepare('SELECT * FROM paycheck_config ORDER BY created_at DESC LIMIT 1').get();
    if (!config) return res.json(null);

    // Use engine's calculatePayDates with past periods
    const { calculatePayDates } = require('../engine');
    const payDates = calculatePayDates(config.start_date, 26, 6);

    res.json({ ...config, payDates });
  } catch (err) {
    console.error('GET /api/paycheck error:', err);
    res.status(500).json({ error: err.message, route: 'GET /paycheck' });
  }
});

router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { amount, start_date, transfer_amount, minimum_spending } = req.body;
    db.prepare('DELETE FROM paycheck_config').run();
    const id = uuidv4();
    db.prepare(
      'INSERT INTO paycheck_config (id, amount, start_date, transfer_amount, minimum_spending) VALUES (?, ?, ?, ?, ?)'
    ).run(id, amount, start_date, transfer_amount || 0, minimum_spending || 0);
    const config = db.prepare('SELECT * FROM paycheck_config WHERE id = ?').get(id);
    res.json(config);
  } catch (err) {
    console.error('POST /api/paycheck error:', err);
    res.status(500).json({ error: err.message, route: 'POST /paycheck', body: req.body });
  }
});

router.patch('/transfer', (req, res) => {
  try {
    const db = getDb();
    const { transfer_amount } = req.body;
    db.prepare(`UPDATE paycheck_config SET transfer_amount = ?, updated_at = datetime('now')`).run(transfer_amount);
    const config = db.prepare('SELECT * FROM paycheck_config ORDER BY created_at DESC LIMIT 1').get();
    res.json(config);
  } catch (err) {
    console.error('PATCH /api/paycheck/transfer error:', err);
    res.status(500).json({ error: err.message, route: 'PATCH /paycheck/transfer', body: req.body });
  }
});

module.exports = router;
