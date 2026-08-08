const db = require('../connection');

function getActiveServersCount() {
  return db.prepare("SELECT COUNT(*) c FROM servers WHERE status = 'ativo'").get().c;
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

function getExpiredClients(limit = 10) {
  return db.prepare(`
    SELECT c.id, c.name, c.plan, c.price, c.discount, c.due_date, c.username,
      s.name AS server_name,
      (c.price - COALESCE(c.discount, 0)) / COALESCE(p.duration_months, 1) AS mrr,
      CAST(julianday('now', 'localtime') - julianday(c.due_date) AS INTEGER) AS days_expired
    FROM clients c
    LEFT JOIN servers s ON s.id = c.server_id
    LEFT JOIN plans p ON p.name = c.plan
    WHERE c.status = 'expirado'
    ORDER BY c.due_date DESC
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

function getMonthSalesTotals(month) {
  const [y, m] = month.split('-').map(Number);
  const endDay = new Date(y, m, 0).getDate();
  return db.prepare(`
    SELECT
      COALESCE(SUM(s.value), 0) AS totalSales,
      COALESCE(SUM(CASE WHEN s.type = 'novo' THEN s.value ELSE 0 END), 0) AS totalNew,
      COALESCE(SUM(CASE WHEN s.type = 'renovacao' THEN s.value ELSE 0 END), 0) AS totalRenewals,
      COUNT(CASE WHEN s.type = 'novo' THEN 1 END) AS countNew,
      COUNT(CASE WHEN s.type = 'renovacao' THEN 1 END) AS countRenewals,
      COUNT(*) AS totalCount,
      COUNT(DISTINCT s.client_id) AS totalClients
    FROM sales s
    WHERE s.sale_date >= ? AND s.sale_date <= ?
  `).get(`${month}-01`, `${month}-${String(endDay).padStart(2,'0')}`);
}
function getMonthlySnapshot(month) {
  const [y, m] = month.split('-').map(Number);
  const endDay = new Date(y, m, 0).getDate();
  const monthEndStr = `${month}-${String(endDay).padStart(2,'0')}`;
  const activeRows = db.prepare(`
    SELECT c.id, c.plan, c.price, c.discount, c.due_date,
      COALESCE(p.duration_months, 1) AS duration_months
    FROM clients c
    LEFT JOIN plans p ON p.name = c.plan
    WHERE c.status = 'ativo' AND c.due_date >= ?
  `).all(monthEndStr);
  const mrr = activeRows.reduce((sum, c) => sum + ((c.price - (c.discount || 0)) / (c.duration_months || 1)), 0);
  const totalActive = activeRows.length;
  const cancelledCount = db.prepare(`
    SELECT COUNT(*) AS cnt FROM clients
    WHERE status IN ('expirado','cancelado')
    AND due_date >= ? AND due_date <= ?
  `).get(`${month}-01`, monthEndStr).cnt;
  const expiringSoonCount = activeRows.filter(c => {
    const d = new Date(c.due_date + 'T00:00:00');
    const end = new Date(monthEndStr + 'T00:00:00');
    const diff = Math.round((d - end) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= 7;
  }).length;
  return {
    totalActive,
    mrr: Math.round(mrr * 100) / 100,
    cancelledCount,
    expiringSoonCount
  };
}
function getMonthlyProfitHistory(monthsBack) {
  const now = new Date();
  const result = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const endDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const startStr = `${month}-01`;
    const endStr = `${month}-${String(endDay).padStart(2, '0')}`;
    const totals = db.prepare(`
      SELECT
        COALESCE(SUM(s.value), 0) AS totalSales,
        COALESCE(SUM(CASE WHEN s.type = 'novo' THEN s.value ELSE 0 END), 0) AS totalNew,
        COALESCE(SUM(CASE WHEN s.type = 'renovacao' THEN s.value ELSE 0 END), 0) AS totalRenewals,
        COUNT(CASE WHEN s.type = 'renovacao' THEN 1 END) AS countRenewals
      FROM sales s
      WHERE s.sale_date >= ? AND s.sale_date <= ?
    `).get(startStr, endStr);
    const serverCostData = db.prepare(`
      SELECT COALESCE(SUM(s.cost * sub.cnt), 0) AS totalCost
      FROM servers s
      JOIN (SELECT server_id, COUNT(*) AS cnt FROM clients WHERE status = 'ativo' GROUP BY server_id) sub ON sub.server_id = s.id
      WHERE s.status = 'ativo'
    `).get();
    const serverCost = serverCostData.totalCost;
    const netProfit = totals.totalSales - serverCost;
    result.push({
      month,
      totalSales: Math.round(totals.totalSales * 100) / 100,
      totalNew: Math.round(totals.totalNew * 100) / 100,
      totalRenewals: Math.round(totals.totalRenewals * 100) / 100,
      countRenewals: totals.countRenewals,
      serverCost: Math.round(serverCost * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100
    });
  }
  return result;
}

module.exports = {
  getActiveServersCount,
  getMonthlyServerCost,
  getAllActiveClients,
  getExpiredClients,
  getExpiredCount,
  getExpiredRevenue,
  getServerRanking,
  getPlanDistribution,
  getMonthSalesTotals,
  getMonthlySnapshot,
  getMonthlyProfitHistory
};
