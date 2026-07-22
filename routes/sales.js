const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { NotFoundError } = require('../lib/errors');

router.get('/', (req, res) => {
  const now = new Date();
  const month = req.query.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [year, mon] = month.split('-').map(Number);
  const monthEnd = new Date(year, mon, 0).getDate();
  const startStr = `${month}-01`;
  const endStr = `${month}-${String(monthEnd).padStart(2, '0')}`;

  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(s.value), 0) AS totalSales,
      COALESCE(SUM(CASE WHEN s.type = 'novo' THEN s.value ELSE 0 END), 0) AS totalNew,
      COALESCE(SUM(CASE WHEN s.type = 'renovacao' THEN s.value ELSE 0 END), 0) AS totalRenewals,
      COUNT(CASE WHEN s.type = 'novo' THEN 1 END) AS countNew,
      COUNT(CASE WHEN s.type = 'renovacao' THEN 1 END) AS countRenewals,
      COUNT(*) AS totalCount
    FROM sales s
    WHERE s.sale_date >= ? AND s.sale_date <= ?
  `).get(startStr, endStr);

  const serverCostData = db.prepare(`
    SELECT COALESCE(SUM(s.cost * sub.cnt), 0) AS totalCost
    FROM servers s
    JOIN (SELECT server_id, COUNT(*) AS cnt FROM clients WHERE status = 'ativo' GROUP BY server_id) sub ON sub.server_id = s.id
    WHERE s.status = 'ativo'
  `).get();
  const monthlyServerCost = serverCostData.totalCost;

  const sales = db.prepare(`
    SELECT s.id, s.client_id, s.type, s.value, s.sale_date,
      c.name AS client_name, c.plan, c.phone
    FROM sales s
    LEFT JOIN clients c ON c.id = s.client_id
    WHERE s.sale_date >= ? AND s.sale_date <= ?
    ORDER BY s.sale_date DESC, s.id DESC
  `).all(startStr, endStr);

  const avgTicket = totals.totalCount > 0 ? (totals.totalSales / totals.totalCount) : 0;
  const netBalance = totals.totalSales - monthlyServerCost;

  res.json({
    month,
    totalSales: Math.round(totals.totalSales * 100) / 100,
    totalNew: Math.round(totals.totalNew * 100) / 100,
    totalRenewals: Math.round(totals.totalRenewals * 100) / 100,
    countNew: totals.countNew,
    countRenewals: totals.countRenewals,
    totalCount: totals.totalCount,
    avgTicket: Math.round(avgTicket * 100) / 100,
    serverCost: Math.round(monthlyServerCost * 100) / 100,
    netBalance: Math.round(netBalance * 100) / 100,
    sales
  });
});

router.delete('/:id', (req, res, next) => {
  try {
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
    if (!sale) throw new NotFoundError('Venda não encontrada.');
    db.prepare('DELETE FROM sales WHERE id = ?').run(req.params.id);
    res.json({ ok: true, sale_id: sale.id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
