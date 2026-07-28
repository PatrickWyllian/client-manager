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
const { authMiddleware } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3400;
const CORS_ORIGIN = process.env.CORS_ORIGIN || `http://localhost:${PORT}`;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// CORS
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin === CORS_ORIGIN || !origin) {
    res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

// Redirect to login for non-API, non-static routes
app.get('*', (req, res) => {
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
  messageQueue.start();
});
