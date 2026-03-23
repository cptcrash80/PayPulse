const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid');

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const subs = db.prepare(`
      SELECT s.*, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM subscriptions s
      LEFT JOIN categories c ON s.category_id = c.id
      ORDER BY s.due_day
    `).all();
    res.json(subs);
  } catch (err) {
    console.error('GET /api/subscriptions error:', err);
    res.status(500).json({ error: err.message, route: 'GET /subscriptions' });
  }
});

router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { name, amount, category_id, due_day, frequency, payment_url, is_variable } = req.body;
    const id = uuidv4();
    db.prepare(
      'INSERT INTO subscriptions (id, name, amount, category_id, due_day, frequency, payment_url, is_variable) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, name, amount, category_id || null, due_day, frequency || 'monthly', payment_url || null, is_variable ? 1 : 0);
    const sub = db.prepare(`
      SELECT s.*, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM subscriptions s LEFT JOIN categories c ON s.category_id = c.id WHERE s.id = ?
    `).get(id);
    res.json(sub);
  } catch (err) {
    console.error('POST /api/subscriptions error:', err);
    res.status(500).json({ error: err.message, route: 'POST /subscriptions', body: req.body });
  }
});

router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { name, amount, category_id, due_day, frequency, is_active, payment_url, is_variable } = req.body;
    db.prepare(
      'UPDATE subscriptions SET name=?, amount=?, category_id=?, due_day=?, frequency=?, is_active=?, payment_url=?, is_variable=? WHERE id=?'
    ).run(name, amount, category_id || null, due_day, frequency, is_active ? 1 : 0, payment_url || null, is_variable ? 1 : 0, req.params.id);
    const sub = db.prepare(`
      SELECT s.*, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM subscriptions s LEFT JOIN categories c ON s.category_id = c.id WHERE s.id = ?
    `).get(req.params.id);
    res.json(sub);
  } catch (err) {
    console.error('PUT /api/subscriptions/:id error:', err);
    res.status(500).json({ error: err.message, route: `PUT /subscriptions/${req.params.id}`, body: req.body });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM subscriptions WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/subscriptions/:id error:', err);
    res.status(500).json({ error: err.message, route: `DELETE /subscriptions/${req.params.id}` });
  }
});

module.exports = router;
