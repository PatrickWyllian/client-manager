// Fuso horário do Brasil — deve ser a PRIMEIRA linha antes de qualquer Date ser usado
process.env.TZ = 'America/Sao_Paulo';

require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');

const WhatsAppService = require('./services/whatsapp');
const MessageQueue = require('./services/messageQueue');
const { startScheduler, restartScheduler, runReminderCheck } = require('./services/scheduler');
const { startAutoBackup } = require('./services/backup');
const { authMiddleware, JWT_SECRET } = require('./middleware/auth');
const jwt = require('jsonwebtoken');

// Handlers globais para erros assíncronos do Baileys/WhatsApp.
// Sem eles, uma única rejeição não tratada derruba o processo inteiro.
process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandledRejection:', reason && reason.stack ? reason.stack : reason);
});
process.on('uncaughtException', (err) => {
  console.error('[process] uncaughtException:', err && err.stack ? err.stack : err);
});

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3400;

if (!process.env.CORS_ORIGIN) {
  console.error('[server] ERRO CRÍTICO: CORS_ORIGIN não definido no ambiente. Encerrando.');
  process.exit(1);
}
const CORS_ORIGIN = process.env.CORS_ORIGIN;

// Confia no proxy reverso (Traefik) para o rate-limit funcionar corretamente
app.set('trust proxy', 1);
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Autenticação do Socket.IO: exige o mesmo JWT usado na API (via cookie ou handshake.auth.token).
io.use((socket, next) => {
  const handshake = socket.handshake;
  const cookieHeader = handshake && handshake.headers ? handshake.headers.cookie : '';
  const cookieToken = cookieHeader
    ? cookieHeader.match(/(?:^|;\s*)token=([^;]+)/)
    : null;
  const token = (handshake.auth && handshake.auth.token) ||
    (cookieToken ? decodeURIComponent(cookieToken[1]) : null);

  if (!token) return next(new Error('not authenticated'));

  try {
    jwt.verify(token, JWT_SECRET);
    return next();
  } catch {
    return next(new Error('not authenticated'));
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// CORS - only allow configured origin
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin === CORS_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Rate limiting - geral
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Muitas requisições. Tente novamente em 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting - login (mais restritivo)
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Muitas tentativas de login. Aguarde 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', generalLimiter);
app.use('/api/auth/login', loginLimiter);

// Static files (before auth)
app.use(express.static(path.join(__dirname, 'public')));

// Auth routes (before middleware)
app.use('/api/auth', require('./routes/auth'));

// Auth middleware for all API routes
app.use('/api', authMiddleware);

// Protected API routes
const waService = new WhatsAppService(io);
const messageQueue = new MessageQueue(waService, io);
waService.setQueue(messageQueue);

app.use('/api/clients', require('./routes/clients')(waService));
app.use('/api/servers', require('./routes/servers'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/whatsapp', require('./routes/whatsapp')(waService, messageQueue));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/settings', require('./routes/settings')(waService, io));
app.use('/api/export', require('./routes/export'));
app.use('/api/resellers', require('./routes/resellers'));

// Health check endpoint (para Swarm/Traefik) - DEVE vir ANTES do catch-all
app.get('/healthz', (req, res) => {
  const waStatus = waService.getStatus();
  const dbOk = true; // SQLite local, assume ok se chegou aqui
  const healthy = waStatus.status === 'connected' && dbOk;
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    whatsapp: waStatus.status,
    database: dbOk ? 'ok' : 'error',
    timestamp: new Date().toISOString()
  });
});

// Redirect to login for non-API, non-static routes
app.get('*', (req, res, next) => {
  if (!req.path.startsWith('/api/') && req.path !== '/' && req.path !== '/login') {
    return res.redirect('/');
  }
  // Serve index.html for root
  if (req.path === '/') {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  next();
});

// Reminders
app.post('/api/reminders/run-now', async (req, res) => {
  try {
    const result = await runReminderCheck(waService, io);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  console.error(`[error] ${err.name}: ${err.message}`);
  res.status(statusCode).json({ error: err.message });
});

// Socket.IO
io.on('connection', (socket) => {
  socket.emit('wa:status', waService.getStatus());
});

server.listen(PORT, process.env.HOST || '0.0.0.0', () => {
  console.log(`\n  Client Manager rodando em http://${process.env.HOST || '0.0.0.0'}:${PORT}\n`);
  startScheduler(waService, io, messageQueue);
  startAutoBackup();
  messageQueue.start();
  // Reconecta o WhatsApp automaticamente após qualquer reinício do app/container.
  waService.connect().catch(err => console.error('[whatsapp] Falha ao conectar no startup:', err.message));
});
