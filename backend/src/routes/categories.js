const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid');

router.get('/', (req, res) => {
  const db = getDb();
  const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
  res.json(categories);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, icon, color } = req.body;
  const id = uuidv4();
  try {
    db.prepare('INSERT INTO categories (id, name, icon, color) VALUES (?, ?, ?, ?)').run(id, name, icon || '📁', color || '#6366f1');
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    res.json(cat);
  } catch (e) {
    res.status(400).json({ error: 'Category name must be unique' });
  }
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { name, icon, color } = req.body;
  try {
    db.prepare('UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ?').run(name, icon, color, req.params.id);
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
    res.json(cat);
  } catch (e) {
    res.status(400).json({ error: 'Update failed' });
  }
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (cat && cat.is_default) {
    return res.status(400).json({ error: 'Cannot delete default categories' });
  }
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
