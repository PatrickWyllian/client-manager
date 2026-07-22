const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { NotFoundError, ValidationError } = require('../lib/errors');
const { validateServer } = require('../lib/validators');

// Listar todos os servidores (com contagem de clientes)
router.get('/', (req, res) => {
  const servers = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM clients c WHERE c.server_id = s.id AND c.status = 'ativo') AS active_clients
    FROM servers s
    ORDER BY s.name COLLATE NOCASE
  `).all();
  res.json(servers);
});

// Buscar servidor por ID
router.get('/:id', (req, res, next) => {
  try {
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
    if (!server) throw new NotFoundError('Servidor não encontrado.');
    res.json(server);
  } catch (err) {
    next(err);
  }
});

// Criar servidor
router.post('/', (req, res, next) => {
  try {
    const validation = validateServer(req.body);
    if (!validation.valid) throw new ValidationError(validation.error);

    const { name, provider, cost, status, notes } = req.body;
    const stmt = db.prepare(
      'INSERT INTO servers (name, provider, cost, status, notes) VALUES (?, ?, ?, ?, ?)'
    );
    const info = stmt.run(name.trim(), provider || null, cost || 0, status || 'ativo', notes || null);
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(server);
  } catch (err) {
    next(err);
  }
});

// Atualizar servidor
router.put('/:id', (req, res, next) => {
  try {
    const existing = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
    if (!existing) throw new NotFoundError('Servidor não encontrado.');

    const { name, provider, cost, status, notes } = req.body;
    db.prepare(
      'UPDATE servers SET name = ?, provider = ?, cost = ?, status = ?, notes = ? WHERE id = ?'
    ).run(
      name ?? existing.name,
      provider ?? existing.provider,
      cost ?? existing.cost,
      status ?? existing.status,
      notes ?? existing.notes,
      req.params.id
    );
    const updated = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Excluir servidor
router.delete('/:id', (req, res, next) => {
  try {
    const existing = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
    if (!existing) throw new NotFoundError('Servidor não encontrado.');

    const clientCount = db.prepare('SELECT COUNT(*) as c FROM clients WHERE server_id = ?').get(req.params.id).c;
    if (clientCount > 0) {
      throw new ValidationError(`Não é possível excluir: ${clientCount} cliente(s) vinculado(s) a este servidor.`);
    }
    db.prepare('DELETE FROM servers WHERE id = ?').run(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
