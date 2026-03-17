const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'budget.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables();
    runMigrations();
    seedDefaults();
  }
  return db;
}

function initTables() {
  const d = getDbRaw();
  d.exec(`
    CREATE TABLE IF NOT EXISTS paycheck_config (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      start_date TEXT NOT NULL,
      transfer_amount REAL NOT NULL DEFAULT 0,
      minimum_spending REAL NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      icon TEXT DEFAULT '📁',
      color TEXT DEFAULT '#6366f1',
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recurring_bills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      category_id TEXT,
      due_day INTEGER NOT NULL,
      frequency TEXT DEFAULT 'monthly',
      is_active INTEGER DEFAULT 1,
      auto_pay INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      category_id TEXT,
      date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS debts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      total_amount REAL NOT NULL,
      remaining_amount REAL NOT NULL,
      minimum_payment REAL NOT NULL DEFAULT 0,
      interest_rate REAL DEFAULT 0,
      due_day INTEGER,
      priority INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      auto_pay INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS debt_payments (
      id TEXT PRIMARY KEY,
      debt_id TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS pay_period_allocations (
      id TEXT PRIMARY KEY,
      pay_date TEXT NOT NULL,
      bill_id TEXT,
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

// ── Migrations ──────────────────────────────────────────────────────
// Checks for missing columns on existing tables and adds them.
// Safe to run repeatedly — each migration checks before acting.
// Add new migrations to the array when the schema evolves.

function runMigrations() {
  const d = getDbRaw();

  const migrations = [
    {
      name: 'add_minimum_spending_to_paycheck_config',
      check: () => !tableHasColumn(d, 'paycheck_config', 'minimum_spending'),
      run: () => d.exec("ALTER TABLE paycheck_config ADD COLUMN minimum_spending REAL NOT NULL DEFAULT 0")
    },
    {
      name: 'add_auto_pay_to_recurring_bills',
      check: () => !tableHasColumn(d, 'recurring_bills', 'auto_pay'),
      run: () => d.exec("ALTER TABLE recurring_bills ADD COLUMN auto_pay INTEGER DEFAULT 0")
    },
    {
      name: 'add_auto_pay_to_debts',
      check: () => !tableHasColumn(d, 'debts', 'auto_pay'),
      run: () => d.exec("ALTER TABLE debts ADD COLUMN auto_pay INTEGER DEFAULT 0")
    }
  ];

  for (const m of migrations) {
    try {
      if (m.check()) {
        console.log(`Running migration: ${m.name}`);
        m.run();
        console.log(`Migration complete: ${m.name}`);
      }
    } catch (err) {
      console.error(`Migration failed: ${m.name}`, err.message);
    }
  }
}

function tableHasColumn(db, table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some(c => c.name === column);
}

function getDbRaw() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function seedDefaults() {
  const d = getDbRaw();
  const count = d.prepare('SELECT COUNT(*) as cnt FROM categories').get();
  if (count.cnt === 0) {
    const defaults = [
      { name: 'Housing', icon: '🏠', color: '#6366f1' },
      { name: 'Utilities', icon: '⚡', color: '#f59e0b' },
      { name: 'Transportation', icon: '🚗', color: '#10b981' },
      { name: 'Food & Groceries', icon: '🛒', color: '#ef4444' },
      { name: 'Insurance', icon: '🛡️', color: '#8b5cf6' },
      { name: 'Entertainment', icon: '🎬', color: '#ec4899' },
      { name: 'Healthcare', icon: '🏥', color: '#06b6d4' },
      { name: 'Personal', icon: '👤', color: '#f97316' },
      { name: 'Subscriptions', icon: '📱', color: '#14b8a6' },
      { name: 'Other', icon: '📦', color: '#64748b' },
    ];
    const stmt = d.prepare('INSERT INTO categories (id, name, icon, color, is_default) VALUES (?, ?, ?, ?, 1)');
    for (const cat of defaults) {
      stmt.run(uuidv4(), cat.name, cat.icon, cat.color);
    }
  }
}

module.exports = { getDb };
