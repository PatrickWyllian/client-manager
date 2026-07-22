const db = require('./connection');

function runMigrations() {
  const serverColumns = db.prepare("PRAGMA table_info(servers)").all();
  if (!serverColumns.some(c => c.name === 'cost')) {
    db.exec("ALTER TABLE servers ADD COLUMN cost REAL DEFAULT 0");
    console.log('[db] Migração: adicionada coluna cost em servers');
  }

  const planColumns = db.prepare("PRAGMA table_info(plans)").all();
  if (!planColumns.some(c => c.name === 'price')) {
    db.exec("ALTER TABLE plans ADD COLUMN price REAL DEFAULT 0");
    console.log('[db] Migração: adicionada coluna price em plans');
  }

  const clientColumns = db.prepare("PRAGMA table_info(clients)").all();
  if (!clientColumns.some(c => c.name === 'discount')) {
    db.exec("ALTER TABLE clients ADD COLUMN discount REAL DEFAULT 0");
    console.log('[db] Migração: adicionada coluna discount em clients');
  }
  if (!clientColumns.some(c => c.name === 'username')) {
    db.exec("ALTER TABLE clients ADD COLUMN username TEXT");
    console.log('[db] Migração: adicionada coluna username em clients');
  }
  if (!clientColumns.some(c => c.name === 'password')) {
    db.exec("ALTER TABLE clients ADD COLUMN password TEXT");
    console.log('[db] Migração: adicionada coluna password em clients');
  }

  const planColumns2 = db.prepare("PRAGMA table_info(plans)").all();
  if (!planColumns2.some(c => c.name === 'screens')) {
    db.exec("ALTER TABLE plans ADD COLUMN screens INTEGER NOT NULL DEFAULT 1");
    console.log('[db] Migração: adicionada coluna screens em plans');

    const allPlans = db.prepare("SELECT id, name FROM plans").all();
    for (const p of allPlans) {
      let screens = 1;
      const n = p.name.toLowerCase();
      if (n.includes('4 telas')) screens = 4;
      else if (n.includes('três telas') || n.includes('3 telas')) screens = 3;
      else if (n.includes('duas telas') || n.includes('2 telas')) screens = 2;
      if (screens > 1) {
        db.prepare("UPDATE plans SET screens = ? WHERE id = ?").run(screens, p.id);
      }
    }
  }

  const notifColumns = db.prepare("PRAGMA table_info(notifications_log)").all();
  if (!notifColumns.some(c => c.name === 'type')) {
    db.exec("ALTER TABLE notifications_log ADD COLUMN type TEXT DEFAULT 'reminder'");
    console.log('[db] Migração: adicionada coluna type em notifications_log');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      value REAL DEFAULT 0,
      sale_date TEXT NOT NULL DEFAULT (date('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      scheduled_at TEXT,
      sent_at TEXT,
      error TEXT,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

module.exports = runMigrations;
