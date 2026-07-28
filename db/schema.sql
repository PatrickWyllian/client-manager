CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price REAL DEFAULT 0,
  duration_months INTEGER NOT NULL DEFAULT 1,
  screens INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS servers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  provider TEXT,
  cost REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ativo', -- ativo | inativo
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL, -- formato: 5521999999999 (DDI+DDD+numero)
  plan TEXT,
  price REAL DEFAULT 0,
  discount REAL DEFAULT 0,
  server_id INTEGER,
  due_date TEXT NOT NULL, -- YYYY-MM-DD
  status TEXT NOT NULL DEFAULT 'ativo', -- ativo | expirado | cancelado
  username TEXT,
  password TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notifications_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

INSERT OR IGNORE INTO settings (key, value) VALUES ('reminder_days_before', '3');
INSERT OR IGNORE INTO settings (key, value) VALUES ('reminder_message_template',
  'Ola {nome}! Seu plano {servidor} vence em {dias} dia(s), no dia {vencimento}. Renove para nao perder o acesso. Qualquer duvida, estou a disposicao!');
INSERT OR IGNORE INTO settings (key, value) VALUES ('reminder_schedule_hour', '11');
INSERT OR IGNORE INTO settings (key, value) VALUES ('reminder_schedule_minute', '30');
INSERT OR IGNORE INTO settings (key, value) VALUES ('reminder_schedule_enabled', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('post_expiry_schedule_hour', '11');
INSERT OR IGNORE INTO settings (key, value) VALUES ('post_expiry_schedule_minute', '35');
INSERT OR IGNORE INTO settings (key, value) VALUES ('post_expiry_schedule_enabled', '1');
INSERT OR IGNORE INTO settings (key, value) VALUES ('recovery_schedule_hour', '11');
INSERT OR IGNORE INTO settings (key, value) VALUES ('recovery_schedule_minute', '40');
INSERT OR IGNORE INTO settings (key, value) VALUES ('recovery_schedule_enabled', '1');

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  value REAL DEFAULT 0,
  sale_date TEXT NOT NULL DEFAULT (date('now', 'localtime')),
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);

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
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);
