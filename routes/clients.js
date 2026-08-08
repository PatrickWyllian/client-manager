const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { sendWelcomeMessage, buildRenewalMessage } = require('../services/scheduler');
const { daysUntil, formatDate, addMonthsPreservingDay } = require('../lib/dateHelpers');
const { encryptText, decryptText } = require('../lib/crypto');
const { NotFoundError, ValidationError } = require('../lib/errors');
const { validateClient } = require('../lib/validators');

module.exports = (waService) => {
  // Listar clientes (com filtros opcionais: server_id, status, plan, filter_name)
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
      password: c.password ? decryptText(c.password) : null,
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
      res.json({
        ...client,
        password: client.password ? decryptText(client.password) : null,
        days_until_due: daysUntil(client.due_date)
      });
    } catch (err) {
      next(err);
    }
  });

  // Criar cliente (Com Transação ACID)
  router.post('/', async (req, res, next) => {
    try {
      const validation = validateClient(req.body);
      if (!validation.valid) throw new ValidationError(validation.error);

      const { name, phone, plan, price, discount, server_id, due_date, status, username, password, notes } = req.body;

      // Criptografia de senha do servidor
      const encPassword = password ? encryptText(password.trim()) : null;

      // Transação atômica
      const createTransaction = db.transaction(() => {
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
          encPassword,
          notes || null
        );

        const clientId = info.lastInsertRowid;

        // Registrar venda
        const saleValue = (price || 0) - (discount || 0);
        if (saleValue > 0) {
          db.prepare("INSERT INTO sales (client_id, type, value, sale_date) VALUES (?, 'novo', ?, date('now'))")
            .run(clientId, saleValue);
        }

        return clientId;
      });

      const newClientId = createTransaction();
      const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(newClientId);

      // Enviar mensagem de boas-vindas via WhatsApp
      if (waService && client.status === 'ativo') {
        try {
          const clientFull = db.prepare(`
            SELECT c.*, s.name AS server_name
            FROM clients c
            LEFT JOIN servers s ON s.id = c.server_id
            WHERE c.id = ?
          `).get(client.id);
          // Pass plain password to message generator
          clientFull.password = password ? password.trim() : null;
          await sendWelcomeMessage(waService, clientFull);
        } catch (err) {
          console.error('[clients] Erro ao enviar boas-vindas:', err.message);
        }
      }

      res.status(201).json({
        ...client,
        password: password || null
      });
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
      
      const encPassword = password !== undefined
        ? (password ? encryptText(password.trim()) : null)
        : existing.password;

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
        encPassword,
        notes ?? existing.notes,
        req.params.id
      );
      const updated = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
      res.json({
        ...updated,
        password: updated.password ? decryptText(updated.password) : null
      });
    } catch (err) {
      next(err);
    }
  });

  // Renovar cliente (Com Transação ACID e Cálculo Robusto de Data)
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

      const renewal = new Date(renewal_date + 'T00:00:00');
      const currentDue = client.due_date ? new Date(client.due_date + 'T00:00:00') : null;
      // Preserva dias restantes: usa a maior entre due_date atual e renewal_date
      const baseDate = currentDue && currentDue > renewal
        ? new Date(currentDue.getTime())
        : new Date(renewal.getTime());
      // Algoritmo robusto que previne estouro de meses curtos (ex: Jan 31 -> Feb 28/29)
      const targetDate = addMonthsPreservingDay(baseDate, months);
      const newDue = formatDate(targetDate);
      const renewValue = (client.price || 0) - (client.discount || 0);

      // Transação Atômica ACID
      const renewTransaction = db.transaction(() => {
        db.prepare("UPDATE clients SET due_date = ?, status = 'ativo' WHERE id = ?").run(newDue, client.id);
        if (renewValue > 0) {
          db.prepare("INSERT INTO sales (client_id, type, value, sale_date) VALUES (?, 'renovacao', ?, ?)")
            .run(client.id, renewValue, renewal_date);
        }
      });

      renewTransaction();

      const updated = db.prepare('SELECT * FROM clients WHERE id = ?').get(client.id);

      // Enfileirar mensagem de renovação
      if (waService) {
        try {
          const clientFull = db.prepare(`
            SELECT c.*, s.name AS server_name
            FROM clients c
            LEFT JOIN servers s ON s.id = c.server_id
            WHERE c.id = ?
          `).get(client.id);
          const renewalMsg = buildRenewalMessage(clientFull, newDue);
          waService.queue.enqueue(client.phone, renewalMsg, 'renewal', client.id, 2);
        } catch (err) {
          console.error('[clients] Erro ao enfileirar renovação:', err.message);
        }
      }
      res.json({
        ...updated,
        password: updated.password ? decryptText(updated.password) : null,
        days_until_due: daysUntil(updated.due_date)
      });
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
