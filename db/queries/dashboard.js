const db = require('../connection');

function getActiveClientsCount() {
  return db.prepare("SELECT COUNT(*) c FROM clients WHERE status = 'ativo'").get().c;
}

function getActiveServersCount() {
  return db.prepare("SELECT COUNT(*) c FROM servers WHERE status = 'ativo'").get().c;
}

function getMonthlyRecurringRevenue() {
  return db.prepare(`
    SELECT COALESCE(SUM((c.price - COALESCE(c.discount, 0)) / COALESCE(p.duration_months, 1)), 0) AS totalMRR
    FROM clients c LEFT JOIN plans p ON p.name = c.plan
    WHERE c.status = 'ativo'
  `).get().totalMRR;
}

function getMonthlyServerCost() {
  return db.prepare(`
    SELECT COALESCE(SUM(s.cost * sub.cnt), 0) AS totalCost
    FROM servers s
    JOIN (SELECT server_id, COUNT(*) AS cnt FROM clients WHERE status = 'ativo' GROUP BY server_id) sub ON sub.server_id = s.id
    WHERE s.status = 'ativo'
  `).get().totalCost;
}

function getAllActiveClients() {
  return db.prepare(`
    SELECT c.id, c.name, c.plan, c.price, c.discount, c.due_date,
      s.name AS server_name, s.cost AS server_cost_raw,
      COALESCE(p.duration_months, 1) AS duration_months,
      (c.price - COALESCE(c.discount, 0)) / COALESCE(p.duration_months, 1) AS mrr_per_client
    FROM clients c
    LEFT JOIN servers s ON s.id = c.server_id
    LEFT JOIN plans p ON p.name = c.plan
    WHERE c.status = 'ativo'
    ORDER BY c.due_date ASC
  `).all();
}

function getCancelledLast30Days(dateStr) {
  return db.prepare("SELECT COUNT(*) c FROM clients WHERE status = 'cancelado' AND created_at >= ?").get(dateStr).c;
}

function getMonthlySales(startStr, endStr) {
  return db.prepare(`
    SELECT COALESCE(SUM(c.price - COALESCE(c.discount, 0)), 0) AS total
    FROM clients c
    WHERE c.status = 'ativo' AND c.due_date >= ? AND c.due_date <= ?
  `).get(startStr, endStr).total;
}

function getExpiredClients(limit = 10) {
  return db.prepare(`
    SELECT c.id, c.name, c.plan, c.price, c.discount, c.due_date, c.username,
      s.name AS server_name,
      (c.price - COALESCE(c.discount, 0)) / COALESCE(p.duration_months, 1) AS mrr,
      CAST(julianday('now') - julianday(c.due_date) AS INTEGER) AS days_expired
    FROM clients c
    LEFT JOIN servers s ON s.id = c.server_id
    LEFT JOIN plans p ON p.name = c.plan
    WHERE c.status = 'expirado'
    ORDER BY c.due_date ASC
    LIMIT ?
  `).all(limit);
}

function getExpiredCount() {
  return db.prepare("SELECT COUNT(*) c FROM clients WHERE status = 'expirado'").get().c;
}

function getExpiredRevenue() {
  return db.prepare(`
    SELECT COALESCE(SUM((c.price - COALESCE(c.discount, 0)) / COALESCE(p.duration_months, 1)), 0) AS total
    FROM clients c
    LEFT JOIN plans p ON p.name = c.plan
    WHERE c.status = 'expirado'
  `).get().total;
}

function getServerRanking() {
  return db.prepare(`
    SELECT s.name, COUNT(c.id) AS client_count,
      COALESCE(SUM((c.price - COALESCE(c.discount, 0)) / COALESCE(p.duration_months, 1)), 0) AS mrr
    FROM servers s
    LEFT JOIN clients c ON c.server_id = s.id AND c.status = 'ativo'
    LEFT JOIN plans p ON p.name = c.plan
    GROUP BY s.id ORDER BY client_count DESC
  `).all();
}

function getPlanDistribution() {
  return db.prepare(`
    SELECT COALESCE(c.plan, 'Sem plano') AS plan_name, COUNT(*) AS count,
      COALESCE(SUM((c.price - COALESCE(c.discount, 0)) / COALESCE(p.duration_months, 1)), 0) AS mrr
    FROM clients c
    LEFT JOIN servers s ON s.id = c.server_id
    LEFT JOIN plans p ON p.name = c.plan
    WHERE c.status = 'ativo'
    GROUP BY c.plan ORDER BY count DESC
  `).all();
}

function getNewClientsCount() {
  return db.prepare(`
    SELECT COUNT(*) AS cnt FROM clients
    WHERE created_at >= date('now', 'start of month')
    AND created_at < date('now', 'start of month', '+1 month')
  `).get().cnt;
}

function getRenewalsCount() {
  return db.prepare(`
    SELECT COUNT(*) AS cnt FROM sales
    WHERE type = 'renovacao'
    AND sale_date >= date('now', 'start of month')
    AND sale_date < date('now', 'start of month', '+1 month')
  `).get().cnt;
}

module.exports = {
  getActiveClientsCount,
  getActiveServersCount,
  getMonthlyRecurringRevenue,
  getMonthlyServerCost,
  getAllActiveClients,
  getCancelledLast30Days,
  getMonthlySales,
  getExpiredClients,
  getExpiredCount,
  getExpiredRevenue,
  getServerRanking,
  getPlanDistribution,
  getNewClientsCount,
  getRenewalsCount
};
