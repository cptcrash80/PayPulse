const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid');

router.get('/', (req, res) => {
  const db = getDb();
  const bills = db.prepare(`
    SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM recurring_bills b
    LEFT JOIN categories c ON b.category_id = c.id
    ORDER BY b.due_day
  `).all();
  res.json(bills);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, amount, category_id, due_day, frequency, auto_pay } = req.body;
  const id = uuidv4();
  db.prepare(
    'INSERT INTO recurring_bills (id, name, amount, category_id, due_day, frequency, auto_pay) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, name, amount, category_id || null, due_day, frequency || 'monthly', auto_pay ? 1 : 0);
  const bill = db.prepare(`
    SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM recurring_bills b
    LEFT JOIN categories c ON b.category_id = c.id
    WHERE b.id = ?
  `).get(id);
  res.json(bill);
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { name, amount, category_id, due_day, frequency, is_active, auto_pay } = req.body;
  db.prepare(
    'UPDATE recurring_bills SET name=?, amount=?, category_id=?, due_day=?, frequency=?, is_active=?, auto_pay=? WHERE id=?'
  ).run(name, amount, category_id || null, due_day, frequency, is_active ? 1 : 0, auto_pay ? 1 : 0, req.params.id);
  const bill = db.prepare(`
    SELECT b.*, c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM recurring_bills b
    LEFT JOIN categories c ON b.category_id = c.id
    WHERE b.id = ?
  `).get(req.params.id);
  res.json(bill);
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM recurring_bills WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
