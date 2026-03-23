const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid');

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const bills = db.prepare(`
      SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM recurring_bills b
      LEFT JOIN categories c ON b.category_id = c.id
      ORDER BY b.due_day
    `).all();
    res.json(bills);
  } catch (err) {
    console.error('GET /api/bills error:', err);
    res.status(500).json({ error: err.message, route: 'GET /bills' });
  }
});

router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { name, amount, category_id, due_day, frequency, auto_pay, payment_url, is_variable } = req.body;
    const id = uuidv4();
    db.prepare(
      'INSERT INTO recurring_bills (id, name, amount, category_id, due_day, frequency, auto_pay, payment_url, is_variable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, name, amount, category_id || null, due_day, frequency || 'monthly', auto_pay ? 1 : 0, payment_url || null, is_variable ? 1 : 0);
    const bill = db.prepare(`
      SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM recurring_bills b LEFT JOIN categories c ON b.category_id = c.id WHERE b.id = ?
    `).get(id);
    res.json(bill);
  } catch (err) {
    console.error('POST /api/bills error:', err);
    res.status(500).json({ error: err.message, route: 'POST /bills', body: req.body });
  }
});

router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { name, amount, category_id, due_day, frequency, is_active, auto_pay, payment_url, is_variable } = req.body;
    db.prepare(
      'UPDATE recurring_bills SET name=?, amount=?, category_id=?, due_day=?, frequency=?, is_active=?, auto_pay=?, payment_url=?, is_variable=? WHERE id=?'
    ).run(name, amount, category_id || null, due_day, frequency, is_active ? 1 : 0, auto_pay ? 1 : 0, payment_url || null, is_variable ? 1 : 0, req.params.id);
    const bill = db.prepare(`
      SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color
      FROM recurring_bills b LEFT JOIN categories c ON b.category_id = c.id WHERE b.id = ?
    `).get(req.params.id);
    res.json(bill);
  } catch (err) {
    console.error('PUT /api/bills/:id error:', err);
    res.status(500).json({ error: err.message, route: `PUT /bills/${req.params.id}`, body: req.body });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM recurring_bills WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/bills/:id error:', err);
    res.status(500).json({ error: err.message, route: `DELETE /bills/${req.params.id}` });
  }
});

module.exports = router;
