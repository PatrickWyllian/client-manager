// AUDIT-01 (LGPD-06): trilha de auditoria de ações administrativas.
//
// Regras de ouro:
//  - NUNCA logar segredos (senha, token, secret, cookie, authorization...).
//  - NUNCA quebrar o fluxo principal por falha na auditoria (fire-and-forget,
//    try/catch interno, apenas console.error).
//
// Uso nos routes: logAudit({ req, action: 'client.create', resourceType: 'client',
//   resourceId: id, details: {...} });  ->  grava em audit_log (better-sqlite3, sincrono).
const db = require('../db/database');

// Chaves cujo VALOR nunca deve ser persistido (valores sensiveis).
const SENSITIVE_KEY = /(pass(word)?|senha|token|secret|authorization|cookie|jwt|api[_-]?key|credential)/i;

const MAX_UA = 400;
const MAX_DETAILS = 8000;

function clientIp(req) {
  if (!req || !req.headers) return null;
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || null;
}

function userAgent(req) {
  const ua = req?.headers?.['user-agent'];
  if (!ua) return null;
  return String(ua).slice(0, MAX_UA);
}

// Remove recursivamente qualquer chave sensivel antes de serializar.
function scrub(value, depth = 0) {
  if (depth > 6 || value == null) return value;
  if (Array.isArray(value)) return value.map(v => scrub(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = scrub(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

function safeDetails(details) {
  if (details == null) return null;
  let json;
  try {
    json = JSON.stringify(scrub(details));
  } catch {
    return null;
  }
  if (json && json.length > MAX_DETAILS) {
    json = json.slice(0, MAX_DETAILS) + '...[truncated]';
  }
  return json;
}

let insertStmt = null;
function stmt() {
  if (!insertStmt) {
    insertStmt = db.prepare(`
      INSERT INTO audit_log
        (user_id, username, action, resource_type, resource_id, ip, user_agent, status, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  }
  return insertStmt;
}

/**
 * Registra uma acao na trilha de auditoria. Nunca lanca.
 * @param {object} opts
 * @param {object} [opts.req]        request express (para IP/user-agent)
 * @param {object} [opts.user]       {id, username}; se ausente usa req.user
 * @param {string} opts.action       ex: 'client.create'
 * @param {string} [opts.resourceType]
 * @param {string|number} [opts.resourceId]
 * @param {string} [opts.status]     'success' | 'failure'
 * @param {object} [opts.details]    dados adicionais (scrub automatico)
 */
function logAudit(opts = {}) {
  try {
    const { req, action, resourceType, resourceId, details, status } = opts;
    const user = opts.user || req?.user || null;
    stmt().run(
      user?.id ?? null,
      user?.username ?? null,
      String(action || 'unknown'),
      resourceType ?? null,
      resourceId != null ? String(resourceId) : null,
      clientIp(req),
      userAgent(req),
      status || 'success',
      safeDetails(details)
    );
  } catch (err) {
    // Auditoria jamais derruba a request.
    console.error('[audit] falha ao registrar:', err.message);
  }
}

module.exports = { logAudit, scrub, clientIp };