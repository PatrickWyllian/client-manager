const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { decryptText } = require('../lib/crypto');

function escapeCsvField(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

// Exportar Clientes para CSV
router.get('/clients', (req, res) => {
  try {
    const clients = db.prepare(`
      SELECT c.*, s.name AS server_name
      FROM clients c
      LEFT JOIN servers s ON s.id = c.server_id
      ORDER BY c.name ASC
    `).all();

    const headers = ['ID', 'Nome', 'Telefone', 'Servidor', 'Plano', 'Valor', 'Desconto', 'Vencimento', 'Status', 'Usuario', 'Senha', 'CriadoEm'];
    const rows = [headers.map(escapeCsvField).join(';')];

    for (const c of clients) {
      const pass = c.password ? decryptText(c.password) : '';
      const row = [
        c.id,
        c.name,
        c.phone,
        c.server_name || '',
        c.plan || '',
        c.price || 0,
        c.discount || 0,
        c.due_date,
        c.status,
        c.username || '',
        pass,
        c.created_at
      ];
      rows.push(row.map(escapeCsvField).join(';'));
    }

    const csvContent = '\uFEFF' + rows.join('\r\n'); // BOM UTF-8 for Excel
    const filename = `relatorio_clientes_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (err) {
    console.error('[export] Erro ao exportar clientes:', err.message);
    res.status(500).json({ error: 'Erro ao gerar relatório de clientes.' });
  }
});

// Exportar Vendas / Financeiro para CSV
router.get('/sales', (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const sales = db.prepare(`
      SELECT s.*, c.name AS client_name, c.phone, c.plan
      FROM sales s
      LEFT JOIN clients c ON c.id = s.client_id
      WHERE s.sale_date LIKE ?
      ORDER BY s.sale_date DESC
    `).all(`${month}%`);

    const headers = ['ID', 'Data', 'Cliente', 'Telefone', 'Plano', 'Tipo', 'Valor'];
    const rows = [headers.map(escapeCsvField).join(';')];

    for (const s of sales) {
      const row = [
        s.id,
        s.sale_date,
        s.client_name || '',
        s.phone || '',
        s.plan || '',
        s.type === 'novo' ? 'Novo Cadastro' : 'Renovação',
        s.value || 0
      ];
      rows.push(row.map(escapeCsvField).join(';'));
    }

    const csvContent = '\uFEFF' + rows.join('\r\n');
    const filename = `relatorio_vendas_${month}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (err) {
    console.error('[export] Erro ao exportar vendas:', err.message);
    res.status(500).json({ error: 'Erro ao gerar relatório de vendas.' });
  }
});

module.exports = router;
