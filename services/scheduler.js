const cron = require('node-cron');
const db = require('../db/database');
const { daysUntil, daysSince, formatDate } = require('../lib/dateHelpers');
let messageQueue = null;
let scheduledJobs = {};

function setMessageQueue(queue) {
  messageQueue = queue;
}

function getSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function getSchedulesFromDB() {
  return {
    reminder: {
      hour: parseInt(getSetting('reminder_schedule_hour', '11'), 10),
      minute: parseInt(getSetting('reminder_schedule_minute', '30'), 10),
      enabled: getSetting('reminder_schedule_enabled', '1') === '1'
    },
    post_expiry: {
      hour: parseInt(getSetting('post_expiry_schedule_hour', '11'), 10),
      minute: parseInt(getSetting('post_expiry_schedule_minute', '35'), 10),
      enabled: getSetting('post_expiry_schedule_enabled', '1') === '1'
    },
    recovery: {
      hour: parseInt(getSetting('recovery_schedule_hour', '11'), 10),
      minute: parseInt(getSetting('recovery_schedule_minute', '40'), 10),
      enabled: getSetting('recovery_schedule_enabled', '1') === '1'
    }
  };
}

function startScheduledJobs(waService, io) {
  Object.values(scheduledJobs).forEach(job => job.stop());
  scheduledJobs = {};

  const schedules = getSchedulesFromDB();

  if (schedules.reminder.enabled) {
    const cronExpr = `${schedules.reminder.minute} ${schedules.reminder.hour} * * *`;
    scheduledJobs.reminder = cron.schedule(cronExpr, () => {
      expireOverdueClients();
      runReminderCheck(waService, io).then(result => {
        console.log('[scheduler] Verificação de vencimentos:', result);
      });
    });
    console.log(`[scheduler] Lembrete agendado para ${schedules.reminder.hour}:${String(schedules.reminder.minute).padStart(2, '0')}`);
  }

  if (schedules.recovery.enabled) {
    const cronExpr = `${schedules.recovery.minute} ${schedules.recovery.hour} * * *`;
    scheduledJobs.recovery = cron.schedule(cronExpr, () => {
      runRecoveryCheck(waService, io).then(result => {
        console.log('[scheduler] Verificação de recuperação:', result);
      });
    });
    console.log(`[scheduler] Recuperação agendada para ${schedules.recovery.hour}:${String(schedules.recovery.minute).padStart(2, '0')}`);
  }

  if (schedules.post_expiry.enabled) {
    const cronExpr = `${schedules.post_expiry.minute} ${schedules.post_expiry.hour} * * *`;
    scheduledJobs.post_expiry = cron.schedule(cronExpr, () => {
      runPostExpiryCheck(waService, io).then(result => {
        console.log('[scheduler] Verificação pós-vencimento:', result);
      });
    });
    console.log(`[scheduler] Pós-vencimento agendado para ${schedules.post_expiry.hour}:${String(schedules.post_expiry.minute).padStart(2, '0')}`);
  }
}

function restartScheduler(waService, io) {
  startScheduledJobs(waService, io);
}

function expireOverdueClients() {
  const today = formatDate(new Date());
  const result = db.prepare(
    "UPDATE clients SET status = 'expirado' WHERE status = 'ativo' AND due_date < ?"
  ).run(today);
  if (result.changes > 0) {
    console.log(`[scheduler] ${result.changes} cliente(s) expirado(s) automaticamente.`);
  }
  return result.changes;
}

// --- Mensagem de lembrete (antes do vencimento) ---
function buildReminderMessage(client) {
  const template = getSetting(
    'reminder_message_template',
    'Olá {nome}! Seu plano {servidor} vence em {dias} dia(s), no dia {vencimento}.'
  );
  const [year, month, day] = client.due_date.split('-');
  const formattedDate = `${day}/${month}/${year}`;
  return template
    .replace(/{nome}/g, client.name)
    .replace(/{servidor}/g, client.server_name || client.plan || 'seu plano')
    .replace(/{dias}/g, String(client.days_until_due))
    .replace(/{vencimento}/g, formattedDate);
}

// --- Mensagem de boas-vindas ---
function buildWelcomeMessage(client) {
  const template = getSetting(
    'welcome_message_template',
    'Olá {nome}! Seja bem-vindo(a)! Seu acesso foi liberado. Plano: {plano}, Servidor: {servidor}, Usuário: {usuario}, Senha: {senha}, Vencimento: {vencimento}, Valor: {valor}.'
  );
  const [year, month, day] = client.due_date.split('-');
  const formattedDate = `${day}/${month}/${year}`;
  const valor = (client.price || 0) - (client.discount || 0);
  return template
    .replace(/{nome}/g, client.name)
    .replace(/{plano}/g, client.plan || '—')
    .replace(/{servidor}/g, client.server_name || '—')
    .replace(/{vencimento}/g, formattedDate)
    .replace(/{usuario}/g, client.username || '—')
    .replace(/{senha}/g, client.password || '—')
    .replace(/{valor}/g, `R$ ${valor.toFixed(2)}`);
}

// --- Mensagem de recuperação (clientes vencidos >15 dias) ---
function buildRecoveryMessage(client) {
  const template = getSetting(
    'recovery_message_template',
    'Olá {nome}! Sentimos sua falta! Seu plano {servidor} venceu há {dias_vencidos} dias. Que tal renovar?'
  );
  const [year, month, day] = client.due_date.split('-');
  const formattedDate = `${day}/${month}/${year}`;
  return template
    .replace(/{nome}/g, client.name)
    .replace(/{servidor}/g, client.server_name || client.plan || 'seu plano')
    .replace(/{dias_vencidos}/g, String(daysSince(client.due_date)))
    .replace(/{vencimento}/g, formattedDate)
    .replace(/{usuario}/g, client.username || '—');
}

// --- Mensagem pós-vencimento (3 dias após expiração) ---
function buildPostExpiryMessage(client) {
  const template = getSetting(
    'post_expiry_message_template',
    'Olá {nome}! Tudo bem? Seu plano {servidor} expirou há {dias_vencidos} dia(s). Sentimos sua falta! 😊\n\nQue tal renovar e continuar aproveitando? Estou aqui para te ajudar!\n\n📅 Vencimento: {vencimento}\n👤 Usuário: {usuario}\n\nResponda esta mensagem para renovar!'
  );
  const [year, month, day] = client.due_date.split('-');
  const formattedDate = `${day}/${month}/${year}`;
  return template
    .replace(/{nome}/g, client.name)
    .replace(/{servidor}/g, client.server_name || client.plan || 'seu plano')
    .replace(/{dias_vencidos}/g, String(daysSince(client.due_date)))
    .replace(/{vencimento}/g, formattedDate)
    .replace(/{usuario}/g, client.username || '—');
}

// --- Mensagem de confirmação de renovação ---
function buildRenewalMessage(client, newDueDate) {
  const template = getSetting(
    'renewal_message_template',
    'Olá {nome}! Sua renovação foi confirmada! Novo vencimento: {novo_vencimento}.'
  );
  const [year, month, day] = newDueDate.split('-');
  const formattedDate = `${day}/${month}/${year}`;
  return template
    .replace(/{nome}/g, client.name)
    .replace(/{plano}/g, client.plan || '—')
    .replace(/{servidor}/g, client.server_name || '—')
    .replace(/{novo_vencimento}/g, formattedDate)
    .replace(/{usuario}/g, client.username || '—');
}

// --- Enviar boas-vindas ao cadastrar cliente ---
async function sendWelcomeMessage(waService, client) {
  try {
    const message = buildWelcomeMessage(client);

    if (messageQueue) {
      messageQueue.enqueue(client.phone, message, 'welcome', client.id, 2);
    } else if (waService.getStatus().status === 'connected') {
      await waService.sendMessage(client.phone, message);
    } else {
      console.log(`[scheduler] WhatsApp desconectado — boas-vindas para ${client.name} enfileirada`);
      return false;
    }

    db.prepare(
      "INSERT INTO notifications_log (client_id, due_date, type) VALUES (?, ?, 'welcome')"
    ).run(client.id, client.due_date);
    return true;
  } catch (err) {
    console.error(`[scheduler] Falha ao enviar boas-vindas para ${client.name}:`, err.message);
    return false;
  }
}

// --- Verificar lembretes de vencimento ---
async function runReminderCheck(waService, io) {
  const reminderDays = parseInt(getSetting('reminder_days_before', '3'), 10);

  const clients = db.prepare(`
    SELECT c.*, s.name AS server_name
    FROM clients c
    LEFT JOIN servers s ON s.id = c.server_id
    WHERE c.status = 'ativo'
  `).all();

  let queuedCount = 0;

  for (const client of clients) {
    const days = daysUntil(client.due_date);
    if (days !== reminderDays) continue;

    const alreadySent = db.prepare(
      "SELECT 1 FROM notifications_log WHERE client_id = ? AND due_date = ? AND type = 'reminder'"
    ).get(client.id, client.due_date);
    if (alreadySent) continue;

    const message = buildReminderMessage({ ...client, days_until_due: days });

    try {
      if (messageQueue) {
        messageQueue.enqueue(client.phone, message, 'reminder', client.id, 1);
      } else if (waService.getStatus().status === 'connected') {
        await waService.sendMessage(client.phone, message);
      }
      db.prepare(
        "INSERT INTO notifications_log (client_id, due_date, type) VALUES (?, ?, 'reminder')"
      ).run(client.id, client.due_date);
      queuedCount++;
      // Log de dedução — o toast "enviada" agora é emitido pela fila (wa:message-sent)
    } catch (err) {
      console.error(`Falha ao enfileirar mensagem para ${client.name}:`, err.message);
    }
  }

  return { queued: queuedCount };
}

// --- Verificação de recuperação (clientes vencidos >N dias) ---
async function runRecoveryCheck(waService, io) {
  const daysAfterExpiry = parseInt(getSetting('recovery_days_after_expiry', '15'), 10);
  const batchSize = parseInt(getSetting('recovery_batch_size', '5'), 10);

  // Buscar clientes expirados há mais de N dias
  const today = new Date();
  const cutoffDate = new Date(today);
  cutoffDate.setDate(cutoffDate.getDate() - daysAfterExpiry);
  const cutoffStr = formatDate(cutoffDate);

  const expiredClients = db.prepare(`
    SELECT c.*, s.name AS server_name
    FROM clients c
    LEFT JOIN servers s ON s.id = c.server_id
    WHERE c.status = 'expirado' AND c.due_date <= ?
    ORDER BY c.due_date ASC
  `).all(cutoffStr);

  // Filtrar quem já recebeu mensagem de recuperação
  const candidates = expiredClients.filter(client => {
    const alreadySent = db.prepare(
      "SELECT 1 FROM notifications_log WHERE client_id = ? AND type = 'recovery'"
    ).get(client.id);
    return !alreadySent;
  });

  // Pegar apenas os N primeiros
  const toSend = candidates.slice(0, batchSize);
  if (toSend.length === 0) return { sent: 0 };

  let queuedCount = 0;

  for (let i = 0; i < toSend.length; i++) {
    const client = toSend[i];
    const message = buildRecoveryMessage(client);

    try {
      if (messageQueue) {
        messageQueue.enqueue(client.phone, message, 'recovery', client.id, 1);
      } else if (waService.getStatus().status === 'connected') {
        await waService.sendMessage(client.phone, message);
      }
      db.prepare(
        "INSERT INTO notifications_log (client_id, due_date, type) VALUES (?, ?, 'recovery')"
      ).run(client.id, client.due_date);
      queuedCount++;
      console.log(`[scheduler] Recuperação enfileirada para ${client.name} (${queuedCount}/${toSend.length})`);
      // Toast "enviada" agora é emitido pela fila (wa:message-sent)
    } catch (err) {
      console.error(`[scheduler] Falha ao enfileirar recuperação para ${client.name}:`, err.message);
    }
  }

  return { queued: queuedCount, total: toSend.length };
}

// --- Verificação pós-vencimento (3 dias após expiração) ---
async function runPostExpiryCheck(waService, io) {
  const postExpiryDays = parseInt(getSetting('post_expiry_days', '3'), 10);

  // Buscar clientes expirados há exatamente N dias
  const today = new Date();
  const targetDate = new Date(today);
  targetDate.setDate(targetDate.getDate() - postExpiryDays);
  const targetStr = formatDate(targetDate);

  const expiredClients = db.prepare(`
    SELECT c.*, s.name AS server_name
    FROM clients c
    LEFT JOIN servers s ON s.id = c.server_id
    WHERE c.status = 'expirado' AND c.due_date = ?
    ORDER BY c.due_date ASC
  `).all(targetStr);

  // Filtrar quem já recebeu mensagem pós-vencimento
  const candidates = expiredClients.filter(client => {
    const alreadySent = db.prepare(
      "SELECT 1 FROM notifications_log WHERE client_id = ? AND type = 'post_expiry'"
    ).get(client.id);
    return !alreadySent;
  });

  if (candidates.length === 0) return { sent: 0 };

  let queuedCount = 0;

  for (const client of candidates) {
    const message = buildPostExpiryMessage(client);

    try {
      if (messageQueue) {
        messageQueue.enqueue(client.phone, message, 'post_expiry', client.id, 1);
      } else if (waService.getStatus().status === 'connected') {
        await waService.sendMessage(client.phone, message);
      }
      db.prepare(
        "INSERT INTO notifications_log (client_id, due_date, type) VALUES (?, ?, 'post_expiry')"
      ).run(client.id, client.due_date);
      queuedCount++;
      console.log(`[scheduler] Pós-vencimento enfileirado para ${client.name} (${queuedCount}/${candidates.length})`);
      // Toast "enviada" agora é emitido pela fila (wa:message-sent)
    } catch (err) {
      console.error(`[scheduler] Falha ao enfileirar pós-vencimento para ${client.name}:`, err.message);
    }
  }

  return { queued: queuedCount, total: candidates.length };
}

function startScheduler(waService, io, queue) {
  if (queue) {
    setMessageQueue(queue);
  }
  expireOverdueClients();
  startScheduledJobs(waService, io);
}

module.exports = {
  startScheduler,
  restartScheduler,
  runReminderCheck,
  runRecoveryCheck,
  runPostExpiryCheck,
  sendWelcomeMessage,
  buildWelcomeMessage,
  buildRecoveryMessage,
  buildRenewalMessage,
  buildPostExpiryMessage
};
