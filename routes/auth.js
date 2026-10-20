const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { generateToken } = require('../middleware/auth');
const { logAudit } = require('../lib/audit');

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    logAudit({
      req,
      action: 'auth.login',
      resourceType: 'session',
      status: 'failure',
      details: { username, reason: 'unknown_user' },
    });
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    logAudit({
      req,
      action: 'auth.login',
      resourceType: 'session',
      status: 'failure',
      details: { username, reason: 'bad_password' },
    });
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }

  const token = generateToken(user);

  res.cookie('token', token, {
    httpOnly: true,
    secure: true, // HTTPS via Traefik
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24h
  });

  logAudit({
    req,
    user: { id: user.id, username: user.username },
    action: 'auth.login',
    resourceType: 'session',
    resourceId: user.id,
    details: { username: user.username },
  });

  res.json({ ok: true, username: user.username });
});

router.post('/logout', (req, res) => {
  // /api/auth nao passa pelo authMiddleware, entao decodificamos o cookie
  // (best-effort) apenas para identificar quem saiu na trilha de auditoria.
  let user = null;
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const jwt = require('jsonwebtoken');
      const { JWT_SECRET } = require('../middleware/auth');
      const decoded = jwt.verify(token, JWT_SECRET);
      user = { id: decoded.id, username: decoded.username };
    }
  } catch { /* token ausente/invalido: registra logout anonimo */ }

  res.clearCookie('token', { httpOnly: true, secure: true, sameSite: 'lax' });
  logAudit({ req, user, action: 'auth.logout', resourceType: 'session' });
  res.json({ ok: true });
});

router.get('/check', (req, res) => {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.json({ authenticated: false });
  }

  try {
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');
    jwt.verify(token, JWT_SECRET);
    res.json({ authenticated: true });
  } catch {
    res.json({ authenticated: false });
  }
});

module.exports = router;