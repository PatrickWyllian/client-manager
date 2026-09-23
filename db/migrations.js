const db = require('./connection');

function runMigrations() {
  const serverColumns = db.prepare('PRAGMA table_info(servers)').all();
  if (!serverColumns.some(c => c.name === 'cost')) {
    db.exec('ALTER TABLE servers ADD COLUMN cost REAL DEFAULT 0');
    console.log('[db] Migração: adicionada coluna cost em servers');
  }

  const planColumns = db.prepare('PRAGMA table_info(plans)').all();
  if (!planColumns.some(c => c.name === 'price')) {
    db.exec('ALTER TABLE plans ADD COLUMN price REAL DEFAULT 0');
    console.log('[db] Migração: adicionada coluna price em plans');
  }

  const clientColumns = db.prepare('PRAGMA table_info(clients)').all();
  if (!clientColumns.some(c => c.name === 'discount')) {
    db.exec('ALTER TABLE clients ADD COLUMN discount REAL DEFAULT 0');
    console.log('[db] Migração: adicionada coluna discount em clients');
  }
  if (!clientColumns.some(c => c.name === 'username')) {
    db.exec('ALTER TABLE clients ADD COLUMN username TEXT');
    console.log('[db] Migração: adicionada coluna username em clients');
  }
  if (!clientColumns.some(c => c.name === 'password')) {
    db.exec('ALTER TABLE clients ADD COLUMN password TEXT');
    console.log('[db] Migração: adicionada coluna password em clients');
  }
  if (!clientColumns.some(c => c.name === 'expired_at')) {
    db.exec('ALTER TABLE clients ADD COLUMN expired_at TEXT');
    console.log('[db] Migração: adicionada coluna expired_at em clients');
  }
  if (!clientColumns.some(c => c.name === 'cancelled_at')) {
    db.exec('ALTER TABLE clients ADD COLUMN cancelled_at TEXT');
    console.log('[db] Migração: adicionada coluna cancelled_at em clients');
  }

  // Backfill idempotente: preenche timestamps de transição para linhas pré-existentes
  // (aproximação documentada: usa due_date como data da baixa).
  const backfillExpired = db.prepare(
    'UPDATE clients SET expired_at = due_date WHERE status = \'expirado\' AND expired_at IS NULL',
  ).run();
  if (backfillExpired.changes > 0) {
    console.log(`[db] Backfill: ${backfillExpired.changes} cliente(s) expirado(s) com expired_at = due_date`);
  }
  const backfillCancelled = db.prepare(
    'UPDATE clients SET cancelled_at = due_date WHERE status = \'cancelado\' AND cancelled_at IS NULL',
  ).run();
  if (backfillCancelled.changes > 0) {
    console.log(`[db] Backfill: ${backfillCancelled.changes} cliente(s) cancelado(s) com cancelled_at = due_date`);
  }

  const planColumns2 = db.prepare('PRAGMA table_info(plans)').all();
  if (!planColumns2.some(c => c.name === 'screens')) {
    db.exec('ALTER TABLE plans ADD COLUMN screens INTEGER NOT NULL DEFAULT 1');
    console.log('[db] Migração: adicionada coluna screens em plans');

    const allPlans = db.prepare('SELECT id, name FROM plans').all();
    for (const p of allPlans) {
      let screens = 1;
      const n = p.name.toLowerCase();
      if (n.includes('4 telas')) screens = 4;
      else if (n.includes('três telas') || n.includes('3 telas')) screens = 3;
      else if (n.includes('duas telas') || n.includes('2 telas')) screens = 2;
      if (screens > 1) {
        db.prepare('UPDATE plans SET screens = ? WHERE id = ?').run(screens, p.id);
      }
    }
  }

  const notifColumns = db.prepare('PRAGMA table_info(notifications_log)').all();
  if (!notifColumns.some(c => c.name === 'type')) {
    db.exec('ALTER TABLE notifications_log ADD COLUMN type TEXT DEFAULT \'reminder\'');
    console.log('[db] Migração: adicionada coluna type em notifications_log');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      value REAL DEFAULT 0,
      sale_date TEXT NOT NULL DEFAULT (date('now', 'localtime')),
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS message_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      phone TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'manual',
      status TEXT NOT NULL DEFAULT 'pending',
      priority INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      scheduled_at TEXT,
      sent_at TEXT,
      error TEXT,
      attempts INTEGER DEFAULT 0,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
    )
  `);

  const mqColumns = db.prepare('PRAGMA table_info(message_queue)').all();
  if (!mqColumns.some(c => c.name === 'attempts')) {
    db.exec('ALTER TABLE message_queue ADD COLUMN attempts INTEGER DEFAULT 0');
    console.log('[db] Migração: adicionada coluna attempts em message_queue');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);

  // Seed admin user from env if not exists
  if (process.env.ADMIN_USER && process.env.ADMIN_PASS) {
    const bcrypt = require('bcryptjs');
    const existing = db.prepare('SELECT 1 FROM users WHERE username = ?').get(process.env.ADMIN_USER);
    if (!existing) {
      const hash = bcrypt.hashSync(process.env.ADMIN_PASS, 10);
      db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(process.env.ADMIN_USER, hash);
      console.log('[db] Usuário admin criado a partir de variáveis de ambiente.');
    }
  }

  // ── REVENDEDORES ──────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS resellers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'ativo',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS reseller_credit_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reseller_id INTEGER NOT NULL,
      server_id INTEGER,
      credits_qty INTEGER NOT NULL DEFAULT 0,
      amount_paid REAL NOT NULL DEFAULT 0,
      cost_per_credit REAL NOT NULL DEFAULT 0,
      purchase_date TEXT NOT NULL DEFAULT (date('now', 'localtime')),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (reseller_id) REFERENCES resellers(id) ON DELETE CASCADE,
      FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE SET NULL
    )
  `);
}

module.exports = runMigrations;
