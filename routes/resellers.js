const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

// ─── helpers ──────────────────────────────────────────────────────────────────
function notFound(res, msg = 'Não encontrado.') {
  return res.status(404).json({ error: msg });
}
function badReq(res, msg) {
  return res.status(400).json({ error: msg });
}

// ══════════════════════════════════════════════════════════════════════════════
// REVENDEDORES
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/resellers — listar todos
router.get('/', (req, res) => {
  const resellers = db.prepare(`
    SELECT r.*,
      (SELECT COUNT(*) FROM reseller_credit_purchases p WHERE p.reseller_id = r.id) AS total_purchases,
      (SELECT COALESCE(SUM(p.credits_qty), 0) FROM reseller_credit_purchases p WHERE p.reseller_id = r.id) AS total_credits,
      (SELECT COALESCE(SUM(p.amount_paid), 0) FROM reseller_credit_purchases p WHERE p.reseller_id = r.id) AS total_revenue,
      (SELECT COALESCE(SUM(p.cost_per_credit * p.credits_qty), 0) FROM reseller_credit_purchases p WHERE p.reseller_id = r.id) AS total_cost
    FROM resellers r
    ORDER BY r.name COLLATE NOCASE
  `).all();

  const result = resellers.map(r => ({
    ...r,
    net_profit: r.total_revenue - r.total_cost
  }));

  res.json(result);
});

// GET /api/resellers/:id — buscar por ID
router.get('/:id', (req, res) => {
  const reseller = db.prepare('SELECT * FROM resellers WHERE id = ?').get(req.params.id);
  if (!reseller) return notFound(res, 'Revendedor não encontrado.');
  res.json(reseller);
});

// POST /api/resellers — criar
router.post('/', (req, res) => {
  const { name, phone, email, notes, status } = req.body;
  if (!name || !name.trim()) return badReq(res, 'O nome do revendedor é obrigatório.');

  const info = db.prepare(
    'INSERT INTO resellers (name, phone, email, notes, status) VALUES (?, ?, ?, ?, ?)'
  ).run(name.trim(), phone || null, email || null, notes || null, status || 'ativo');

  const created = db.prepare('SELECT * FROM resellers WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(created);
});

// PUT /api/resellers/:id — editar
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM resellers WHERE id = ?').get(req.params.id);
  if (!existing) return notFound(res, 'Revendedor não encontrado.');

  const { name, phone, email, notes, status } = req.body;
  db.prepare(
    'UPDATE resellers SET name = ?, phone = ?, email = ?, notes = ?, status = ? WHERE id = ?'
  ).run(
    name ?? existing.name,
    phone ?? existing.phone,
    email ?? existing.email,
    notes ?? existing.notes,
    status ?? existing.status,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM resellers WHERE id = ?').get(req.params.id));
});

// DELETE /api/resellers/:id — excluir
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM resellers WHERE id = ?').get(req.params.id);
  if (!existing) return notFound(res, 'Revendedor não encontrado.');
  db.prepare('DELETE FROM resellers WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// ══════════════════════════════════════════════════════════════════════════════
// COMPRAS DE CRÉDITOS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/resellers/purchases/all — todas as compras (com filtro de mês)
router.get('/purchases/all', (req, res) => {
  const { month, reseller_id } = req.query;
  let query = `
    SELECT p.*,
      r.name AS reseller_name,
      s.name AS server_name,
      (p.amount_paid - (p.cost_per_credit * p.credits_qty)) AS net_profit
    FROM reseller_credit_purchases p
    LEFT JOIN resellers r ON r.id = p.reseller_id
    LEFT JOIN servers s ON s.id = p.server_id
    WHERE 1=1
  `;
  const params = [];

  if (month) {
    query += ` AND strftime('%Y-%m', p.purchase_date) = ?`;
    params.push(month);
  }
  if (reseller_id) {
    query += ` AND p.reseller_id = ?`;
    params.push(reseller_id);
  }
  query += ` ORDER BY p.purchase_date DESC, p.created_at DESC`;

  const purchases = db.prepare(query).all(...params);
  res.json(purchases);
});

// GET /api/resellers/:id/purchases — compras de um revendedor
router.get('/:id/purchases', (req, res) => {
  const { month } = req.query;
  let query = `
    SELECT p.*,
      s.name AS server_name,
      (p.amount_paid - (p.cost_per_credit * p.credits_qty)) AS net_profit
    FROM reseller_credit_purchases p
    LEFT JOIN servers s ON s.id = p.server_id
    WHERE p.reseller_id = ?
  `;
  const params = [req.params.id];

  if (month) {
    query += ` AND strftime('%Y-%m', p.purchase_date) = ?`;
    params.push(month);
  }
  query += ` ORDER BY p.purchase_date DESC`;

  res.json(db.prepare(query).all(...params));
});

// POST /api/resellers/purchases — registrar compra
router.post('/purchases', (req, res) => {
  const { reseller_id, server_id, credits_qty, amount_paid, cost_per_credit, purchase_date, notes } = req.body;

  if (!reseller_id)    return badReq(res, 'Revendedor é obrigatório.');
  if (!credits_qty || credits_qty <= 0) return badReq(res, 'Quantidade de créditos deve ser maior que zero.');
  if (amount_paid == null || amount_paid < 0) return badReq(res, 'Valor pago é obrigatório.');
  if (cost_per_credit == null || cost_per_credit < 0) return badReq(res, 'Custo por crédito é obrigatório.');

  const reseller = db.prepare('SELECT id FROM resellers WHERE id = ?').get(reseller_id);
  if (!reseller) return notFound(res, 'Revendedor não encontrado.');

  const info = db.prepare(`
    INSERT INTO reseller_credit_purchases
      (reseller_id, server_id, credits_qty, amount_paid, cost_per_credit, purchase_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    reseller_id,
    server_id || null,
    parseInt(credits_qty),
    parseFloat(amount_paid),
    parseFloat(cost_per_credit),
    purchase_date || new Date().toISOString().slice(0, 10),
    notes || null
  );

  const created = db.prepare(`
    SELECT p.*, s.name AS server_name, r.name AS reseller_name,
      (p.amount_paid - (p.cost_per_credit * p.credits_qty)) AS net_profit
    FROM reseller_credit_purchases p
    LEFT JOIN servers s ON s.id = p.server_id
    LEFT JOIN resellers r ON r.id = p.reseller_id
    WHERE p.id = ?
  `).get(info.lastInsertRowid);

  res.status(201).json(created);
});

// PUT /api/resellers/purchases/:id — editar compra
router.put('/purchases/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM reseller_credit_purchases WHERE id = ?').get(req.params.id);
  if (!existing) return notFound(res, 'Compra não encontrada.');

  const { server_id, credits_qty, amount_paid, cost_per_credit, purchase_date, notes } = req.body;

  db.prepare(`
    UPDATE reseller_credit_purchases
    SET server_id = ?, credits_qty = ?, amount_paid = ?, cost_per_credit = ?, purchase_date = ?, notes = ?
    WHERE id = ?
  `).run(
    server_id ?? existing.server_id,
    credits_qty != null ? parseInt(credits_qty) : existing.credits_qty,
    amount_paid != null ? parseFloat(amount_paid) : existing.amount_paid,
    cost_per_credit != null ? parseFloat(cost_per_credit) : existing.cost_per_credit,
    purchase_date ?? existing.purchase_date,
    notes ?? existing.notes,
    req.params.id
  );

  const updated = db.prepare(`
    SELECT p.*, s.name AS server_name, r.name AS reseller_name,
      (p.amount_paid - (p.cost_per_credit * p.credits_qty)) AS net_profit
    FROM reseller_credit_purchases p
    LEFT JOIN servers s ON s.id = p.server_id
    LEFT JOIN resellers r ON r.id = p.reseller_id
    WHERE p.id = ?
  `).get(req.params.id);

  res.json(updated);
});

// DELETE /api/resellers/purchases/:id — excluir compra
router.delete('/purchases/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM reseller_credit_purchases WHERE id = ?').get(req.params.id);
  if (!existing) return notFound(res, 'Compra não encontrada.');
  db.prepare('DELETE FROM reseller_credit_purchases WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// ══════════════════════════════════════════════════════════════════════════════
// RELATÓRIO MENSAL
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/resellers/report?month=YYYY-MM
router.get('/report/summary', (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);

  // KPIs globais do mês
  const kpis = db.prepare(`
    SELECT
      COUNT(*)                              AS total_purchases,
      COALESCE(SUM(credits_qty), 0)         AS total_credits,
      COALESCE(SUM(amount_paid), 0)         AS total_revenue,
      COALESCE(SUM(cost_per_credit * credits_qty), 0) AS total_cost
    FROM reseller_credit_purchases
    WHERE strftime('%Y-%m', purchase_date) = ?
  `).get(month);

  kpis.net_profit = kpis.total_revenue - kpis.total_cost;

  // Por revendedor
  const byReseller = db.prepare(`
    SELECT
      r.id, r.name, r.phone, r.status,
      COUNT(p.id)                               AS purchases,
      COALESCE(SUM(p.credits_qty), 0)           AS credits,
      COALESCE(SUM(p.amount_paid), 0)           AS revenue,
      COALESCE(SUM(p.cost_per_credit * p.credits_qty), 0) AS cost
    FROM resellers r
    LEFT JOIN reseller_credit_purchases p
      ON p.reseller_id = r.id AND strftime('%Y-%m', p.purchase_date) = ?
    GROUP BY r.id
    ORDER BY revenue DESC
  `).all(month);

  const byResellerFull = byReseller.map(r => ({
    ...r,
    net_profit: r.revenue - r.cost
  }));

  res.json({ month, kpis, byReseller: byResellerFull });
});

module.exports = router;
