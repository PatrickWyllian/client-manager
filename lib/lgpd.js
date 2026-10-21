// LGPD-11: recursos do titular (DSAR) e retenção de dados pessoais.
//
// Centraliza a lógica de exportação/anonimização para clientes e revendedores,
// reutilizada pelos routes (ações pontuais do titular) e pelo scheduler
// (política de retenção). NUNCA logar PII aqui — a auditoria cuida disso.
const db = require('../db/database');

const ANON_PREFIX = 'Anonimizado #';
const ANON_MESSAGE = '[anonimizado]';

function nowTs() {
  return db.prepare("SELECT datetime('now', 'localtime') t").get().t;
}

function currentConsentVersion() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'consent_version'").get();
  return row && row.value ? row.value : '1';
}

// ── EXPORTAÇÃO (DIREITO DE ACESSO / PORTABILIDADE) ───────────────────────────
// Retorna todos os dados pessoais do titular reunidos de todas as tabelas.
function exportClientData(clientId) {
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
  if (!client) return null;
  const sales = db.prepare('SELECT * FROM sales WHERE client_id = ? ORDER BY id').all(clientId);
  const messageQueue = db.prepare('SELECT * FROM message_queue WHERE client_id = ? ORDER BY id').all(clientId);
  const notifications = db.prepare('SELECT * FROM notifications_log WHERE client_id = ? ORDER BY id').all(clientId);
  return {
    exported_at: new Date().toISOString(),
    subject: { type: 'client', id: clientId },
    client,
    sales,
    message_queue: messageQueue,
    notifications_log: notifications,
  };
}

function exportResellerData(resellerId) {
  const reseller = db.prepare('SELECT * FROM resellers WHERE id = ?').get(resellerId);
  if (!reseller) return null;
  const purchases = db.prepare('SELECT * FROM reseller_credit_purchases WHERE reseller_id = ? ORDER BY id').all(resellerId);
  return {
    exported_at: new Date().toISOString(),
    subject: { type: 'reseller', id: resellerId },
    reseller,
    reseller_credit_purchases: purchases,
  };
}

// ── ANONIMIZAÇÃO (DIREITO DE ELIMINAÇÃO — mantém obrigação legal/financeira) ──
// Mantém a linha do cliente e as vendas (histórico financeiro), removendo PII.
function anonymizeClient(clientId) {
  const existing = db.prepare('SELECT id, name, phone, status FROM clients WHERE id = ?').get(clientId);
  if (!existing) return null;

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE clients
      SET name = ?, phone = '', username = NULL, password = NULL, notes = NULL
      WHERE id = ?
    `).run(`${ANON_PREFIX}${clientId}`, clientId);

    const mq = db.prepare(`
      UPDATE message_queue SET phone = '', message = ?
      WHERE client_id = ? AND (phone <> '' OR message <> ?)
    `).run(ANON_MESSAGE, clientId, ANON_MESSAGE);
    return { clientId, messages_anonymized: mq.changes };
  });

  return tx();
}

// Anonimiza PII de revendedor mantendo a linha e as compras de crédito.
function anonymizeReseller(resellerId) {
  const existing = db.prepare('SELECT id, name, phone, email FROM resellers WHERE id = ?').get(resellerId);
  if (!existing) return null;

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE resellers
      SET name = ?, phone = NULL, email = NULL, notes = NULL
      WHERE id = ?
    `).run(`${ANON_PREFIX}${resellerId}`, resellerId);
    return { resellerId };
  });

  return tx();
}

// ── EXCLUSÃO REAL (direito de eliminação — respeita FKs) ────────────────────
function hardDeleteClient(clientId) {
  const existing = db.prepare('SELECT id FROM clients WHERE id = ?').get(clientId);
  if (!existing) return null;

  const tx = db.transaction(() => {
    // message_queue usa ON DELETE SET NULL; removemos explicitamente para não
    // deixar telefone/conteúdo órfão. sales e notifications_log caem em CASCADE.
    const mq = db.prepare('DELETE FROM message_queue WHERE client_id = ?').run(clientId);
    db.prepare('DELETE FROM clients WHERE id = ?').run(clientId);
    return { clientId, messages_deleted: mq.changes };
  });

  return tx();
}

function hardDeleteReseller(resellerId) {
  const existing = db.prepare('SELECT id FROM resellers WHERE id = ?').get(resellerId);
  if (!existing) return null;

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM resellers WHERE id = ?').run(resellerId);
    return { resellerId };
  });

  return tx();
}

// ── POLÍTICA DE RETENÇÃO (job diário) ───────────────────────────────────────
// Anonimiza PII de clientes inativos cuja referência de inatividade é mais
// antiga que `days`. Mantém linha e vendas. `days <= 0` desativa.
function applyClientRetention(days) {
  if (!Number.isFinite(days) || days <= 0) return { disabled: true, clients: 0 };
  const offset = `-${days} days`;
  const rows = db.prepare(`
    SELECT id FROM clients
    WHERE name NOT LIKE ?
      AND (
        (status IN ('expirado', 'cancelado')
          AND COALESCE(expired_at, cancelled_at, due_date) < date('now', 'localtime', ?))
        OR due_date < date('now', 'localtime', ?)
      )
  `).all(`${ANON_PREFIX}%`, offset, offset);

  let count = 0;
  for (const row of rows) {
    try {
      anonymizeClient(row.id);
      count++;
    } catch (err) {
      console.error(`[lgpd] Falha ao anonimizar cliente ${row.id}:`, err.message);
    }
  }
  return { disabled: false, clients: count };
}

// Anonimiza conteúdo (phone/message) de mensagens mais antigas que `days`.
function applyMessageRetention(days) {
  if (!Number.isFinite(days) || days <= 0) return { disabled: true, messages: 0 };
  const result = db.prepare(`
    UPDATE message_queue SET phone = '', message = ?
    WHERE created_at < datetime('now', 'localtime', ?)
      AND message <> ?
  `).run(ANON_MESSAGE, `-${days} days`, ANON_MESSAGE);
  return { disabled: false, messages: result.changes };
}

module.exports = {
  ANON_PREFIX,
  ANON_MESSAGE,
  currentConsentVersion,
  nowTs,
  exportClientData,
  exportResellerData,
  anonymizeClient,
  anonymizeReseller,
  hardDeleteClient,
  hardDeleteReseller,
  applyClientRetention,
  applyMessageRetention,
};