const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid');

// Get all paid items for a pay period
router.get('/:payDate', (req, res) => {
  try {
    const db = getDb();
    const items = db.prepare('SELECT * FROM period_paid_items WHERE pay_date = ?').all(req.params.payDate);
    // Return as a lookup map: { "bill:abc-123": true, "debt:def-456": true }
    const paidMap = {};
    for (const item of items) {
      paidMap[`${item.item_type}:${item.item_id}`] = true;
    }
    res.json(paidMap);
  } catch (err) {
    console.error('GET /api/paid/:payDate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Toggle paid status for an item in a period
router.post('/:payDate', (req, res) => {
  try {
    const db = getDb();
    const { item_id, item_type } = req.body;
    const { payDate } = req.params;

    // Check if already paid
    const existing = db.prepare(
      'SELECT id FROM period_paid_items WHERE pay_date = ? AND item_id = ? AND item_type = ?'
    ).get(payDate, item_id, item_type);

    if (existing) {
      // Unmark as paid
      db.prepare('DELETE FROM period_paid_items WHERE id = ?').run(existing.id);
    } else {
      // Mark as paid
      const id = uuidv4();
      db.prepare(
        'INSERT INTO period_paid_items (id, pay_date, item_id, item_type) VALUES (?, ?, ?, ?)'
      ).run(id, payDate, item_id, item_type);
    }

    // Return updated map
    const items = db.prepare('SELECT * FROM period_paid_items WHERE pay_date = ?').all(payDate);
    const paidMap = {};
    for (const item of items) {
      paidMap[`${item.item_type}:${item.item_id}`] = true;
    }
    res.json(paidMap);
  } catch (err) {
    console.error('POST /api/paid/:payDate error:', err);
    res.status(500).json({ error: err.message, body: req.body });
  }
});

// Get amount overrides for a pay period
router.get('/:payDate/overrides', (req, res) => {
  try {
    const db = getDb();
    const items = db.prepare('SELECT * FROM period_amount_overrides WHERE pay_date = ?').all(req.params.payDate);
    const overrides = {};
    for (const item of items) {
      overrides[`${item.item_type}:${item.item_id}`] = item.amount;
    }
    res.json(overrides);
  } catch (err) {
    console.error('GET /api/paid/:payDate/overrides error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Set amount override for a variable bill in a period
router.post('/:payDate/overrides', (req, res) => {
  try {
    const db = getDb();
    const { item_id, item_type, amount } = req.body;
    const { payDate } = req.params;

    const existing = db.prepare(
      'SELECT id FROM period_amount_overrides WHERE pay_date = ? AND item_id = ? AND item_type = ?'
    ).get(payDate, item_id, item_type);

    if (existing) {
      db.prepare(`UPDATE period_amount_overrides SET amount = ?, updated_at = datetime('now') WHERE id = ?`).run(amount, existing.id);
    } else {
      const id = uuidv4();
      db.prepare(
        'INSERT INTO period_amount_overrides (id, pay_date, item_id, item_type, amount) VALUES (?, ?, ?, ?, ?)'
      ).run(id, payDate, item_id, item_type, amount);
    }

    const items = db.prepare('SELECT * FROM period_amount_overrides WHERE pay_date = ?').all(payDate);
    const overrides = {};
    for (const item of items) {
      overrides[`${item.item_type}:${item.item_id}`] = item.amount;
    }
    res.json(overrides);
  } catch (err) {
    console.error('POST /api/paid/:payDate/overrides error:', err);
    res.status(500).json({ error: err.message, body: req.body });
  }
});

// Get snowball override for a pay period
router.get('/:payDate/snowball', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM period_snowball_overrides WHERE pay_date = ?').get(req.params.payDate);
    res.json(row || { pay_date: req.params.payDate, max_extra: null, notes: null });
  } catch (err) {
    console.error('GET /api/paid/:payDate/snowball error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Set snowball override for a pay period
// max_extra: null = normal, 0 = skip, number = cap at that amount
router.post('/:payDate/snowball', (req, res) => {
  try {
    const db = getDb();
    const { max_extra, notes } = req.body;
    const { payDate } = req.params;

    const existing = db.prepare('SELECT id FROM period_snowball_overrides WHERE pay_date = ?').get(payDate);

    if (max_extra === null || max_extra === undefined || max_extra === '') {
      // Remove override — go back to normal
      if (existing) {
        db.prepare('DELETE FROM period_snowball_overrides WHERE id = ?').run(existing.id);
      }
    } else if (existing) {
      db.prepare(`UPDATE period_snowball_overrides SET max_extra = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`).run(max_extra, notes || null, existing.id);
    } else {
      const id = uuidv4();
      db.prepare('INSERT INTO period_snowball_overrides (id, pay_date, max_extra, notes) VALUES (?, ?, ?, ?)').run(id, payDate, max_extra, notes || null);
    }

    const row = db.prepare('SELECT * FROM period_snowball_overrides WHERE pay_date = ?').get(payDate);
    res.json(row || { pay_date: payDate, max_extra: null, notes: null });
  } catch (err) {
    console.error('POST /api/paid/:payDate/snowball error:', err);
    res.status(500).json({ error: err.message, body: req.body });
  }
});

module.exports = router;
