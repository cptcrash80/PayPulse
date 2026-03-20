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

module.exports = router;
