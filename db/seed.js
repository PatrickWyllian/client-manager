const db = require('./connection');
const bcrypt = require('bcryptjs');

function runSeed() {
  const upsertSetting = db.prepare(
    "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
  );
  upsertSetting.run('welcome_message_template',
    'Olá {nome}! Seja bem-vindo(a)!\n\nSeu acesso foi liberado com sucesso:\n\n📺 Plano: {plano}\n🖥️ Servidor: {servidor}\n👤 Usuário: {usuario}\n🔒 Senha: {senha}\n📅 Vencimento: {vencimento}\n💰 Valor: {valor}\n\nQualquer dúvida, estou à disposição!');
  upsertSetting.run('recovery_message_template',
    'Olá {nome}! Sentimos sua falta!\n\nSeu plano {servidor} venceu há {dias_vencidos} dias.\n\nQue tal renovar e continuar aproveitando? Estou aqui para ajudar!\n\n📅 Vencimento: {vencimento}\n👤 Usuário: {usuario}\n\nResponda esta mensagem para renovar!');
  upsertSetting.run('renewal_message_template',
    'Olá {nome}! Sua renovação foi confirmada com sucesso!\n\nSeu acesso foi estendido:\n\n📺 Plano: {plano}\n🖥️ Servidor: {servidor}\n📅 Novo vencimento: {novo_vencimento}\n👤 Usuário: {usuario}\n\nObrigado pela preferência! Qualquer dúvida, estou à disposição!');
  upsertSetting.run('recovery_days_after_expiry', '15');
  upsertSetting.run('recovery_batch_size', '5');
  upsertSetting.run('recovery_interval_minutes', '5');
  upsertSetting.run('post_expiry_days', '3');
  upsertSetting.run('reminder_schedule_hour', '10');
  upsertSetting.run('reminder_schedule_minute', '0');
  upsertSetting.run('reminder_schedule_enabled', '1');
  upsertSetting.run('post_expiry_schedule_hour', '11');
  upsertSetting.run('post_expiry_schedule_minute', '35');
  upsertSetting.run('post_expiry_schedule_enabled', '1');
  upsertSetting.run('recovery_schedule_hour', '11');
  upsertSetting.run('recovery_schedule_minute', '40');
  upsertSetting.run('recovery_schedule_enabled', '1');
  upsertSetting.run('post_expiry_message_template',
    'Olá {nome}! Tudo bem? Seu plano {servidor} expirou há {dias_vencidos} dia(s). Sentimos sua falta! 😊\n\nQue tal renovar e continuar aproveitando? Estou aqui para te ajudar!\n\n📅 Vencimento: {vencimento}\n👤 Usuário: {usuario}\n\nResponda esta mensagem para renovar!');

  const planCount = db.prepare("SELECT COUNT(*) c FROM plans").get().c;
  if (planCount === 0) {
    const insertPlan = db.prepare("INSERT INTO plans (name, price, duration_months) VALUES (?, ?, ?)");
    insertPlan.run('Mensal', 35, 1);
    insertPlan.run('Trimestral', 90, 3);
    insertPlan.run('Semestral', 160, 6);
    insertPlan.run('Anual', 300, 12);
    insertPlan.run('Promocional', 25, 1);
    console.log('[db] Seed: planos padrão criados');
  } else {
    const defaultPrices = { 'Mensal': 35, 'Trimestral': 90, 'Semestral': 160, 'Anual': 300, 'Promocional': 25 };
    const updatePrice = db.prepare("UPDATE plans SET price = ? WHERE name = ? AND price = 0");
    for (const [name, price] of Object.entries(defaultPrices)) {
      updatePrice.run(price, name);
    }
    if (!db.prepare("SELECT id FROM plans WHERE name = 'Promocional'").get()) {
      db.prepare("INSERT INTO plans (name, price, duration_months) VALUES (?, ?, ?)").run('Promocional', 25, 1);
    }
  }

  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'admin123';
  const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUser);
  if (!existingAdmin) {
    const hash = bcrypt.hashSync(adminPass, 10);
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(adminUser, hash);
    console.log(`[db] Seed: usuário admin criado (${adminUser})`);
  }
}

module.exports = runSeed;
