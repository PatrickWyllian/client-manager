const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { sendWelcomeMessage, buildRenewalMessage } = require('../services/scheduler');
const { daysUntil } = require('../lib/dateHelpers');
const { NotFoundError, ValidationError } = require('../lib/errors');
const { validateClient } = require('../lib/validators');

module.exports = (waService) => {
  // Listar clientes (com filtros opcionais: server_id, status, expiring_in)
  router.get('/', (req, res) => {
    let query = `
      SELECT c.*, s.name AS server_name, COALESCE(s.cost * COALESCE(p.screens, 1) * COALESCE(p.duration_months, 1), 0) AS server_cost
      FROM clients c
      LEFT JOIN servers s ON s.id = c.server_id
      LEFT JOIN plans p ON p.name = c.plan
      WHERE 1=1
    `;
    const params = [];

    if (req.query.server_id) {
      query += ' AND c.server_id = ?';
      params.push(req.query.server_id);
    }
    if (req.query.status) {
      query += ' AND c.status = ?';
      params.push(req.query.status);
    }
    if (req.query.plan) {
      query += ' AND c.plan = ?';
      params.push(req.query.plan);
    }
    query += req.query.status === 'expirado' ? ' ORDER BY c.due_date DESC' : ' ORDER BY c.due_date ASC';

    const clients = db.prepare(query).all(...params).map(c => ({
      ...c,
      days_until_due: daysUntil(c.due_date)
    }));

    res.json(clients);
  });

  // Buscar um cliente
  router.get('/:id', (req, res, next) => {
    try {
      const client = db.prepare(`
        SELECT c.*, s.name AS server_name, COALESCE(s.cost * COALESCE(p.screens, 1) * COALESCE(p.duration_months, 1), 0) AS server_cost FROM clients c
        LEFT JOIN servers s ON s.id = c.server_id
        LEFT JOIN plans p ON p.name = c.plan
        WHERE c.id = ?
      `).get(req.params.id);
      if (!client) throw new NotFoundError('Cliente não encontrado.');
      res.json({ ...client, days_until_due: daysUntil(client.due_date) });
    } catch (err) {
      next(err);
    }
  });

  // Criar cliente
  router.post('/', async (req, res, next) => {
    try {
      const validation = validateClient(req.body);
      if (!validation.valid) throw new ValidationError(validation.error);

      const { name, phone, plan, price, discount, server_id, due_date, status, username, password, notes } = req.body;

      const stmt = db.prepare(`
        INSERT INTO clients (name, phone, plan, price, discount, server_id, due_date, status, username, password, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(
        name.trim(),
        phone.trim(),
        plan || null,
        price || 0,
        discount || 0,
        server_id || null,
        due_date,
        status || 'ativo',
        username || null,
        password || null,
        notes || null
      );
      const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(info.lastInsertRowid);

      // Enviar mensagem de boas-vindas via WhatsApp
      if (waService && client.status === 'ativo') {
        try {
          const clientFull = db.prepare(`
            SELECT c.*, s.name AS server_name
            FROM clients c
            LEFT JOIN servers s ON s.id = c.server_id
            WHERE c.id = ?
          `).get(client.id);
          await sendWelcomeMessage(waService, clientFull);
        } catch (err) {
          console.error('[clients] Erro ao enviar boas-vindas:', err.message);
        }
      }

      // Registrar venda
      const saleValue = (price || 0) - (discount || 0);
      if (saleValue > 0) {
        db.prepare("INSERT INTO sales (client_id, type, value, sale_date) VALUES (?, 'novo', ?, date('now'))")
          .run(client.id, saleValue);
      }
      res.status(201).json(client);
    } catch (err) {
      next(err);
    }
  });

  // Atualizar cliente
  router.put('/:id', (req, res, next) => {
    try {
      const existing = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
      if (!existing) throw new NotFoundError('Cliente não encontrado.');

      const { name, phone, plan, price, discount, server_id, due_date, status, username, password, notes } = req.body;
      db.prepare(`
        UPDATE clients SET name = ?, phone = ?, plan = ?, price = ?, discount = ?, server_id = ?,
          due_date = ?, status = ?, username = ?, password = ?, notes = ? WHERE id = ?
      `).run(
        name ?? existing.name,
        phone ?? existing.phone,
        plan ?? existing.plan,
        price ?? existing.price,
        discount ?? existing.discount,
        server_id ?? existing.server_id,
        due_date ?? existing.due_date,
        status ?? existing.status,
        username ?? existing.username,
        password ?? existing.password,
        notes ?? existing.notes,
        req.params.id
      );
      const updated = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // Renovar cliente
  router.post('/:id/renew', async (req, res, next) => {
    try {
      const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
      if (!client) throw new NotFoundError('Cliente não encontrado.');

      const { renewal_date } = req.body;
      if (!renewal_date) throw new ValidationError('Data da renovação é obrigatória.');

      let months = 1;
      if (client.plan) {
        const plan = db.prepare('SELECT duration_months FROM plans WHERE name = ?').get(client.plan);
        if (plan) months = plan.duration_months;
      }

      const baseDate = new Date(renewal_date + 'T00:00:00');
      baseDate.setMonth(baseDate.getMonth() + months);
      const newDue = baseDate.toISOString().slice(0, 10);

      db.prepare("UPDATE clients SET due_date = ?, status = 'ativo' WHERE id = ?").run(newDue, client.id);
      const renewValue = (client.price || 0) - (client.discount || 0);
      if (renewValue > 0) {
        db.prepare("INSERT INTO sales (client_id, type, value, sale_date) VALUES (?, 'renovacao', ?, ?)")
          .run(client.id, renewValue, renewal_date);
      }

      const updated = db.prepare('SELECT * FROM clients WHERE id = ?').get(client.id);
      if (waService && waService.getStatus().status === 'connected') {
        try {
          const clientFull = db.prepare(`
            SELECT c.*, s.name AS server_name
            FROM clients c
            LEFT JOIN servers s ON s.id = c.server_id
            WHERE c.id = ?
          `).get(client.id);
          const renewalMsg = buildRenewalMessage(clientFull, newDue);
          await waService.sendMessage(client.phone, renewalMsg);
        } catch (err) {
          console.error('[clients] Erro ao enviar renovação:', err.message);
        }
      }
      res.json({ ...updated, days_until_due: daysUntil(updated.due_date) });
    } catch (err) {
      next(err);
    }
  });

  // Excluir cliente
  router.delete('/:id', (req, res, next) => {
    try {
      const existing = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
      if (!existing) throw new NotFoundError('Cliente não encontrado.');
      db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
};
