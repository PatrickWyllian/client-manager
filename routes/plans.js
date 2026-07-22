const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { NotFoundError, ValidationError } = require('../lib/errors');
const { validatePlan } = require('../lib/validators');

// Listar todos os planos (com contagem de clientes)
router.get('/', (req, res) => {
  const plans = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM clients c WHERE c.plan = p.name AND c.status = 'ativo') AS active_clients
    FROM plans p
    ORDER BY p.duration_months ASC
  `).all();
  res.json(plans);
});

// Buscar plano por ID
router.get('/:id', (req, res, next) => {
  try {
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id);
    if (!plan) throw new NotFoundError('Plano não encontrado.');
    res.json(plan);
  } catch (err) {
    next(err);
  }
});

// Criar plano
router.post('/', (req, res, next) => {
  try {
    const validation = validatePlan(req.body);
    if (!validation.valid) throw new ValidationError(validation.error);

    const { name, price, duration_months, screens } = req.body;
    const stmt = db.prepare(
      'INSERT INTO plans (name, price, duration_months, screens) VALUES (?, ?, ?, ?)'
    );
    const info = stmt.run(name.trim(), price || 0, duration_months || 1, screens || 1);
    const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(plan);
  } catch (err) {
    next(err);
  }
});

// Atualizar plano
router.put('/:id', (req, res, next) => {
  try {
    const existing = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id);
    if (!existing) throw new NotFoundError('Plano não encontrado.');

    const { name, price, duration_months, screens } = req.body;
    db.prepare(
      'UPDATE plans SET name = ?, price = ?, duration_months = ?, screens = ? WHERE id = ?'
    ).run(
      name ?? existing.name,
      price ?? existing.price,
      duration_months ?? existing.duration_months,
      screens ?? existing.screens,
      req.params.id
    );
    const updated = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Excluir plano
router.delete('/:id', (req, res, next) => {
  try {
    const existing = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id);
    if (!existing) throw new NotFoundError('Plano não encontrado.');

    const clientCount = db.prepare(
      "SELECT COUNT(*) as c FROM clients WHERE plan = ?"
    ).get(existing.name).c;
    if (clientCount > 0) {
      throw new ValidationError(`Não é possível excluir: ${clientCount} cliente(s) vinculado(s) a este plano.`);
    }
    db.prepare('DELETE FROM plans WHERE id = ?').run(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
