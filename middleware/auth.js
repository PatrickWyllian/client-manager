const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-me';

function authMiddleware(req, res, next) {
  const url = req.originalUrl || req.url;

  // Allow login and check routes without auth
  if (url.includes('/api/auth/login') || url.includes('/api/auth/check')) {
    return next();
  }

  // Allow static files
  if (!url.startsWith('/api/')) {
    return next();
  }

  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido.' });
  }
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

module.exports = { authMiddleware, generateToken, JWT_SECRET };
