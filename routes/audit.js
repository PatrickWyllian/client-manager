const express = require('express');
const router = express.Router();
const db = require('../db/database');

// AUDIT-01 (LGPD-06): leitura da trilha de auditoria (somente leitura).
// Protegido pelo authMiddleware global montado em /api.
// Ex: GET /api/audit?limit=50&action=client.create&username=admin&resource_type=client
router.get('/', (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 1000);
    let query = 'SELECT id, user_id, username, action, resource_type, resource_id, ip, user_agent, status, details, created_at FROM audit_log WHERE 1=1';
    const params = [];

    if (req.query.action) { query += ' AND action = ?'; params.push(String(req.query.action)); }
    if (req.query.username) { query += ' AND username = ?'; params.push(String(req.query.username)); }
    if (req.query.resource_type) { query += ' AND resource_type = ?'; params.push(String(req.query.resource_type)); }
    if (req.query.status) { query += ' AND status = ?'; params.push(String(req.query.status)); }
    if (req.query.since) { query += ' AND created_at >= ?'; params.push(String(req.query.since)); }

    query += ' ORDER BY id DESC LIMIT ?';
    params.push(limit);

    res.json(db.prepare(query).all(...params));
  } catch (err) {
    next(err);
  }
});

module.exports = router;