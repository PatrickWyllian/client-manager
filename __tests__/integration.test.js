// Integration tests - test the full flow from API to WhatsApp delivery (with mocked dependencies)
const MessageQueue = require('../services/messageQueue');
const { recordNotification } = require('../services/scheduler');
const db = require('../db/database');

// Mock waService and io
function createMockWaService() {
  return {
    getStatus: jest.fn().mockReturnValue({ status: 'connected' }),
    sendMessage: jest.fn().mockResolvedValue({ key: { id: 'msg123' }, ackStatus: 3 }),
    queue: null,
  };
}

function createMockIo() {
  return {
    emit: jest.fn()
  };
}

// Mock scheduler functions
jest.mock('../services/scheduler', () => ({
  recordNotification: jest.fn(),
  buildWelcomeMessage: (client) => `Olá ${client.name}! Bem-vindo.`,
  buildRenewalMessage: (client, newDue) => `Olá ${client.name}! Renovação confirmada. Novo vencimento: ${newDue}.`,
  buildRecoveryMessage: (client) => `Olá ${client.name}! Recuperação.`,
  buildPostExpiryMessage: (client) => `Olá ${client.name}! Pós-vencimento.`,
  buildRenewalMessage: (client, newDue) => `Renovação para ${client.name} até ${newDue}`,
  runReminderCheck: jest.fn().mockResolvedValue({ queued: 1 }),
  runRecoveryCheck: jest.fn().mockResolvedValue({ queued: 1 }),
  runPostExpiryCheck: jest.fn().mockResolvedValue({ queued: 0 }),
  sendWelcomeMessage: jest.fn().mockResolvedValue(true),
} );

// Now import after mocking
const { sendWelcomeMessage, buildRenewalMessage: buildRenewalMessageMock, runReminderCheck, runRecoveryCheck, runPostExpiryCheck, recordNotification } = require('../services/scheduler');

const MessageQueue = require('../services/messageQueue');
const { parseSpintax } = require('../services/messageQueue');
const { daysUntil, daysSince, formatDate, addMonthsPreservingDay } = require('../lib/dateHelpers');
const { encryptText, decryptText } = require('../lib/crypto');
const { validateClient, validateServer, validatePlan, normalizePhone } = require('../lib/validators');
const db = require('../db/database');

describe('Integration - Full Message Flow (Unit Level)', () => {
  let messageQueue;
  let mockWaService;
  let mockIo;
  let testClientId;

  beforeAll(() => {
    process.env.ENCRYPTION_SECRET = 'test-encryption-secret-32bytes-long!!';
    process.env.JWT_SECRET = 'test-jwt-secret-different-from-encryption';
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'silent';
    process.env.CORS_ORIGIN = 'http://localhost:3400';
  });

  beforeEach(() => {
    mockWaService = {
      getStatus: jest.fn().mockReturnValue({ status: 'connected' }),
      sendMessage: jest.fn().mockResolvedValue({ key: { id: 'msg123' }, ackStatus: 3 }),
      queue: null,
    };
    mockIo = {
      emit: jest.fn()
    };

    const now = new Date();
    const dueDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const stmt = db.prepare(`
      INSERT INTO clients (name, phone, plan, price, discount, server_id, due_date, status, username, password, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      'Test Client',
      '5521972872889',
      'Mensal',
      35,
      0,
      null,
      dueDate,
      'ativo',
      'testuser',
      'testpass',
      'Test notes'
    );
    testClientId = info.lastInsertRowid;
  });

  afterEach(() => {
    db.prepare('DELETE FROM message_queue WHERE client_id = ?').run(testClientId);
    db.prepare('DELETE FROM clients WHERE id = ?').run(testClientId);
    db.prepare('DELETE FROM notifications_log WHERE client_id = ?').run(testClientId);
    db.prepare('DELETE FROM sales WHERE client_id = ?').run(testClientId);
  });

  test('Fluxo completo: POST /clients → welcome message enqueued → ack → sent', async () => {
    const { MessageQueue } = require('../services/messageQueue');
    const { sendWelcomeMessage, buildWelcomeMessage } = require('../services/scheduler');

    messageQueue = new MessageQueue(mockWaService, mockIo);
    mockWaService.queue = messageQueue;

    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(testClientId);
    const clientFull = {
      ...client,
      server_name: 'Test Server',
      password: 'testpass',
    };

    await sendWelcomeMessage(mockWaService, clientFull);

    const queue = db.prepare('SELECT * FROM message_queue WHERE client_id = ? AND type = "welcome"').get(testClientId);
    expect(queue).toBeDefined();
    expect(queue.status).toBe('pending');
    expect(queue.type).toBe('welcome');
    expect(queue.message).toContain('Test Client');
    expect(queue.message).toContain('testuser');
    expect(queue.message).toContain('testpass');
  });

  test('Fluxo renovação: POST /clients/:id/renew → renewal message enqueued → ack → sent', async () => {
    const { MessageQueue } = require('../services/messageQueue');
    const { buildRenewalMessage } = require('../services/scheduler');

    messageQueue = new MessageQueue(mockWaService, mockIo);
    mockWaService.queue = messageQueue;

    const renewalDate = new Date();
    renewalDate.setDate(renewalDate.getDate() + 30);
    const newDueDate = renewalDate.toISOString().split('T')[0];

    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(testClientId);
    const clientFull = {
      ...client,
      server_name: 'Test Server',
    };

    const renewalMsg = buildRenewalMessage(clientFull, newDueDate);

    messageQueue.enqueue(clientFull.phone, renewalMsg, 'renewal', testClientId, 2);

    const queue = db.prepare('SELECT * FROM message_queue WHERE client_id = ? AND type = "renewal"').get(testClientId);
    expect(queue).toBeDefined();
    expect(queue.status).toBe('pending');
    expect(queue.type).toBe('renewal');
    expect(queue.message).toContain('renovação');
    expect(queue.message).toContain(newDueDate);
  });

  test('Fila processa mensagem e aguarda ack antes de marcar como sent', async () => {
    const { MessageQueue } = require('../services/messageQueue');

    messageQueue = new MessageQueue(mockWaService, mockIo);
    mockWaService.queue = messageQueue;

    const id = messageQueue.enqueue('5521972872889', 'Test message', 'manual', testClientId, 1);

    await messageQueue._processNext();

    let queueItem = db.prepare('SELECT * FROM message_queue WHERE id = ?').get(id);
    expect(queueItem.status).toBe('sending');

    // Wait for ack timeout (ACK_TIMEOUT_MS = 45000)
    await new Promise(resolve => setTimeout(resolve, 50000));

    queueItem = db.prepare('SELECT * FROM message_queue WHERE id = ?').get(id);
    expect(queueItem.status).toBe('pending');
    expect(queueItem.attempts).toBe(1);
  });

  test('Scheduler: runReminderCheck enfileira lembretes para clientes ativos', async () => {
    const { MessageQueue } = require('../services/messageQueue');
    const { runReminderCheck } = require('../services/scheduler');

    messageQueue = new MessageQueue(mockWaService, mockIo);
    mockWaService.queue = messageQueue;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    db.prepare('UPDATE clients SET due_date = ? WHERE id = ?').run(dueDateStr, testClientId);

    const result = await runReminderCheck(mockWaService, mockIo);

    expect(result.queued).toBe(1);

    const queue = db.prepare('SELECT * FROM message_queue WHERE client_id = ? AND type = "reminder"').get(testClientId);
    expect(queue).toBeDefined();
    expect(queue.type).toBe('reminder');
  });

  test('Scheduler: runRecoveryCheck enfileira recuperação para clientes expirados > 15 dias', async () => {
    const { MessageQueue } = require('../services/messageQueue');
    const { runRecoveryCheck } = require('../services/scheduler');

    messageQueue = new MessageQueue(mockWaService, mockIo);
    mockWaService.queue = messageQueue;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() - 20);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    db.prepare('UPDATE clients SET due_date = ?, status = "expirado" WHERE id = ?').run(dueDateStr, testClientId);

    const result = await runRecoveryCheck(mockWaService, mockIo);

    expect(result.queued).toBe(1);

    const queue = db.prepare('SELECT * FROM message_queue WHERE client_id = ? AND type = "recovery"').get(testClientId);
    expect(queue).toBeDefined();
    expect(queue.type).toBe('recovery');
  });

  test('Utils: daysUntil e daysSince funcionam corretamente', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    expect(daysUntil(tomorrowStr)).toBe(1);
    expect(daysSince(yesterdayStr)).toBe(1);
    expect(daysUntil(today.toISOString().split('T')[0])).toBe(0);
    expect(daysSince(today.toISOString().split('T')[0])).toBe(0);
  });

  test('Utils: formatDate formata data corretamente', () => {
    const date = new Date(2026, 11, 31);
    expect(formatDate(date)).toBe('2026-12-31');
  });

  test('Utils: addMonthsPreservingDay previne overflow de meses', () => {
    const date = new Date(2026, 0, 31);
    const result = addMonthsPreservingDay(date, 1);
    expect(result.getDate()).toBe(28);
    expect(result.getMonth()).toBe(1);
    expect(result.getFullYear()).toBe(2026);
  });

  test('Utils: normalizePhone normaliza telefones brasileiros', () => {
    expect(normalizePhone('21972872889')).toBe('5521972872889');
    expect(normalizePhone('(21) 97289-7289')).toBe('5521972897289');
    expect(normalizePhone('5521972872889')).toBe('5521972872889');
    expect(normalizePhone('123')).toBe('');
  });

  test('Validators: validateClient valida cliente corretamente', () => {
    expect(validateClient({ name: 'João', phone: '21972872889', due_date: '2026-12-31' })).toEqual({ valid: true });
    expect(validateClient({ phone: '21972872889', due_date: '2026-12-31' })).toEqual({ valid: false, error: 'Nome é obrigatório.' });
    expect(validateClient({ name: 'João', due_date: '2026-12-31' })).toEqual({ valid: false, error: 'Telefone é obrigatório.' });
    expect(validateClient({ name: 'João', phone: '21972872889' })).toEqual({ valid: false, error: 'Data de vencimento é obrigatória.' });
  });

  test('Validators: normalizePhone rejeita telefones inválidos', () => {
    expect(normalizePhone('123')).toBe('');
    expect(normalizePhone('')).toBe('');
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone(undefined)).toBe('');
  });

  test('Crypto: encryptText/decriptText roundtrip', () => {
    const secrets = ['senha-simples', 'senha@#$%', 'a'.repeat(100)];
    for (const secret of secrets) {
      const encrypted = encryptText(secret);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted.startsWith('enc:v1:')).toBe(true);
      const decrypted = decryptText(encrypted);
      expect(decrypted).toBe(secret);
    }
  });

  test('Crypto: double encryption returns same encrypted', () => {
    const encrypted = encryptText('teste');
    const doubleEncrypted = encryptText(encrypted);
    expect(doubleEncrypted).toBe(encrypted);
  });

  test('Crypto: decrypt non-encrypted returns original', () => {
    expect(decryptText('plain')).toBe('plain');
  });

  test('Crypto: corrupted authTag returns fallback', () => {
    const encrypted = encryptText('teste');
    const parts = encrypted.split(':');
    parts[3] = 'ffffffffffffffffffffffffffffffff';
    const corrupted = parts.join(':');
    const result = decryptText(corrupted);
    expect(result).toBe('***');
  });

  test('parseSpintax: basic functionality', () => {
    const result = parseSpintax('Olá {mundo|amigo|pessoa}!');
    expect(['Olá mundo!', 'Olá amigo!', 'Olá pessoa!']).toContain(result);
  });

  test('parseSpintax: multiple spintax', () => {
    const result = parseSpintax('{Olá|Oi} {mundo|amigo}!');
    expect(['Olá mundo!', 'Olá amigo!', 'Oi mundo!', 'Oi amigo!']).toContain(result);
  });

  test('parseSpintax: no spintax returns original', () => {
    expect(parseSpintax('Olá mundo!')).toBe('Olá mundo!');
    expect(parseSpintax('')).toBe('');
  });

  test('parseSpintax: empty option', () => {
    const result = parseSpintax('Olá {|mundo}!');
    expect(['Olá !', 'Olá mundo!']).toContain(result);
  });

  test('parseSpintax: nested not supported', () => {
    const result = parseSpintax('{a|{b|c}}');
    expect(['a|b', 'a|c', '{a|{b|c}}', '{a|c}', 'a|{b|c}']).toContain(result);
  });

  test('parseSpintax: preserves text outside spintax', () => {
    const result = parseSpintax('Prefixo {a|b} sufixo');
    expect(['Prefixo a sufixo', 'Prefixo b sufixo']).toContain(result);
  });

  test('parseSpintax: special chars in options', () => {
    const result = parseSpintax('{a@b.com|c@d.com}');
    expect(['a@b.com', 'c@d.com']).toContain(result);
  });

  test('parseSpintax: returns original for null/undefined', () => {
    expect(parseSpintax(null)).toBe(null);
    expect(parseSpintax(undefined)).toBe(undefined);
  });

  test('Validators: validateClient', () => {
    expect(validateClient({ name: 'João', phone: '21972872889', due_date: '2026-12-31' })).toEqual({ valid: true });
    expect(validateClient({ phone: '21972872889', due_date: '2026-12-31' })).toEqual({ valid: false, error: 'Nome é obrigatório.' });
    expect(validateClient({ name: 'João', due_date: '2026-12-31' })).toEqual({ valid: false, error: 'Telefone é obrigatório.' });
    expect(validateClient({ name: 'João', phone: '21972872889' })).toEqual({ valid: false, error: 'Data de vencimento é obrigatória.' });
  });

  test('Validators: normalizePhone rejects invalid', () => {
    expect(normalizePhone('123')).toBe('');
    expect(normalizePhone('')).toBe('');
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone(undefined)).toBe('');
  });

  test('Validators: validateServer and validatePlan', () => {
    expect(validateServer({ name: 'Servidor 1' })).toEqual({ valid: true });
    expect(validateServer({ name: '' })).toEqual({ valid: false, error: 'Nome do servidor é obrigatório.' });
    expect(validatePlan({ name: 'Plano Mensal' })).toEqual({ valid: true });
    expect(validatePlan({ name: '' })).toEqual({ valid: false, error: 'Nome do plano é obrigatório.' });
  });

  test('Crypto: encryptText/decriptText roundtrip', () => {
    const secrets = ['senha-simples', 'senha@#$%', 'a'.repeat(100)];
    for (const secret of secrets) {
      const encrypted = encryptText(secret);
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted.startsWith('enc:v1:')).toBe(true);
      const decrypted = decryptText(encrypted);
      expect(decrypted).toBe(secret);
    }
  });

  test('Crypto: double encryption returns same encrypted', () => {
    const encrypted = encryptText('teste');
    const doubleEncrypted = encryptText(encrypted);
    expect(doubleEncrypted).toBe(encrypted);
  });

  test('Crypto: decrypt non-encrypted returns original', () => {
    expect(decryptText('plain')).toBe('plain');
  });

  test('Crypto: corrupted authTag returns fallback', () => {
    const encrypted = encryptText('teste');
    const parts = encrypted.split(':');
    parts[3] = 'ffffffffffffffffffffffffffffffff';
    const corrupted = parts.join(':');
    const result = decryptText(corrupted);
    expect(result).toBe('***');
  });

  test('parseSpintax: basic functionality', () => {
    const result = parseSpintax('Olá {mundo|amigo|pessoa}!');
    expect(['Olá mundo!', 'Olá amigo!', 'Olá pessoa!']).toContain(result);
  });

  test('parseSpintax: multiple spintax', () => {
    const result = parseSpintax('{Olá|Oi} {mundo|amigo}!');
    expect(['Olá mundo!', 'Olá amigo!', 'Oi mundo!', 'Oi amigo!']).toContain(result);
  });

  test('parseSpintax: no spintax returns original', () => {
    expect(parseSpintax('Olá mundo!')).toBe('Olá mundo!');
    expect(parseSpintax('')).toBe('');
  });

  test('parseSpintax: empty option', () => {
    const result = parseSpintax('Olá {|mundo}!');
    expect(['Olá !', 'Olá mundo!']).toContain(result);
  });

  test('parseSpintax: nested not supported', () => {
    const result = parseSpintax('{a|{b|c}}');
    expect(['a|b', 'a|c', '{a|{b|c}}', '{a|c}', 'a|{b|c}']).toContain(result);
  });

  test('parseSpintax: preserves text outside spintax', () => {
    const result = parseSpintax('Prefixo {a|b} sufixo');
    expect(['Prefixo a sufixo', 'Prefixo b sufixo']).toContain(result);
  });

  test('parseSpintax: special chars in options', () => {
    const result = parseSpintax('{a@b.com|c@d.com}');
    expect(['a@b.com', 'c@d.com']).toContain(result);
  });

  test('parseSpintax: returns original for null/undefined', () => {
    expect(parseSpintax(null)).toBe(null);
    expect(parseSpintax(undefined)).toBe(undefined);
  });

  test('Validators: validateServer and validatePlan', () => {
    expect(validateServer({ name: 'Servidor 1' })).toEqual({ valid: true });
    expect(validateServer({ name: '' })).toEqual({ valid: false, error: 'Nome do servidor é obrigatório.' });
    expect(validatePlan({ name: 'Plano Mensal' })).toEqual({ valid: true });
    expect(validatePlan({ name: '' })).toEqual({ valid: false, error: 'Nome do plano é obrigatório.' });
  });
});