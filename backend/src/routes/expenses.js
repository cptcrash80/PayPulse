const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid');

router.get('/', (req, res) => {
  const db = getDb();
  const { start, end, category_id } = req.query;
  let sql = `
    SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM expenses e
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE 1=1
  `;
  const params = [];
  if (start) { sql += ' AND e.date >= ?'; params.push(start); }
  if (end) { sql += ' AND e.date <= ?'; params.push(end); }
  if (category_id) { sql += ' AND e.category_id = ?'; params.push(category_id); }
  sql += ' ORDER BY e.date DESC';

  const expenses = db.prepare(sql).all(...params);
  res.json(expenses);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, amount, category_id, date, notes } = req.body;
  const id = uuidv4();
  db.prepare(
    'INSERT INTO expenses (id, name, amount, category_id, date, notes) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, name, amount, category_id || null, date, notes || null);
  const expense = db.prepare(`
    SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM expenses e
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE e.id = ?
  `).get(id);
  res.json(expense);
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { name, amount, category_id, date, notes } = req.body;
  db.prepare(
    'UPDATE expenses SET name=?, amount=?, category_id=?, date=?, notes=? WHERE id=?'
  ).run(name, amount, category_id || null, date, notes || null, req.params.id);
  const expense = db.prepare(`
    SELECT e.*, c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM expenses e
    LEFT JOIN categories c ON e.category_id = c.id
    WHERE e.id = ?
  `).get(req.params.id);
  res.json(expense);
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
