const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
} = require('@whiskeysockets/baileys');
const { proto } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const { normalizePhone } = require('../lib/validators');

const AUTH_DIR = path.join(__dirname, '..', 'data', 'wa-auth');

// janela máxima para aguardar confirmação (ack) do servidor após o envio
// Valor padrão 45s; pode ser sobrescrito via setting 'ack_timeout_ms'
const DEFAULT_ACK_TIMEOUT_MS = 45000;

class WhatsAppService {
  constructor(io) {
    this.io = io;
    this.sock = null;
    this.status = 'disconnected';
    this.qrDataUrl = null;
    this.phoneNumber = null;
    this.queue = null;
    this.reconnectTimer = null;
    this.reconnectDelayMs = 15000;
    this.disconnectCount = 0;
    this.consecutiveFailures = 0;
    this.sessionEstablished = false;
    this.lastStatusCode = null;
    this.pendingAcks = new Map();
    this.ackTimeoutMs = DEFAULT_ACK_TIMEOUT_MS;
    this.lastQrTime = 0;
    this.manualReconnect = false;
    this.pairingWindowUntil = 0;
  }

  setQueue(queue) {
    this.queue = queue;
  }

  setAckTimeoutMs(ms) {
    if (ms && ms > 0) this.ackTimeoutMs = ms;
  }

  emitStatus() {
    this.io.emit('wa:status', {
      status: this.status,
      qr: this.qrDataUrl,
      phoneNumber: this.phoneNumber,
      disconnectCount: this.disconnectCount,
      lastStatusCode: this.lastStatusCode,
    });
  }

  isSocketUsable() {
    // Baileys nesta versão não expõe readyState no objeto ws.
    // "Conectado de verdade" é sinalizado pelo evento connection: open.
    return this.status === 'connected' && !!this.sock;
  }

  async sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // Remove o "me" pré-setado pelo requestPairingCode (pareamento incompleto),
  // restaurando o fluxo de registro na próxima conexão. Não mexe em creds de
  // pareamento real (que têm `account` preenchido pelo configureSuccessfulPairing).
  stripPairingCodeCreds() {
    try {
      const credsPath = path.join(AUTH_DIR, 'creds.json');
      if (fs.existsSync(credsPath)) {
        const c = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
        if (c.me && !c.account && !c.registered) {
          delete c.me;
          delete c.pairingCode;
          fs.writeFileSync(credsPath, JSON.stringify(c, null, '\t'));
          console.log('[whatsapp] Creds de pairing code incompleto limpos (me/pairingCode) — fluxo de registro restaurado.');
        }
      }
    } catch (e) {
      console.error('[whatsapp] Erro ao limpar creds de pairing code:', e.message);
    }
  }

  // Pareamento por código de 8 dígitos (alternativa mais robusta ao QR):
  // o código vale minutos, não queima QR refs e completa na MESMA conexão.
  async requestPairingCode(phone) {
    const normalized = normalizePhone(phone);
    if (!normalized) throw new Error('Telefone inválido.');
    if (this.status === 'connected') throw new Error('WhatsApp já está conectado.');

    // Garante um socket na fase de pareamento (status 'qr' = handshake concluído)
    if (this.status !== 'qr' || !this.sock) {
      if (this.status !== 'connecting') {
        this.connect(true); // manual: reseta backoff/circuit breaker
      }
      const deadline = Date.now() + 25000;
      while ((this.status !== 'qr' || !this.sock) && Date.now() < deadline) {
        await this.sleep(500);
      }
      if (this.status !== 'qr' || !this.sock) {
        throw new Error('WhatsApp não chegou à fase de pareamento a tempo. Clique em "Conectar" e tente de novo.');
      }
    }

    // Janela de pareamento: 5 min para digitar o código no celular
    this.pairingWindowUntil = Date.now() + 5 * 60 * 1000;
    const code = await this.sock.requestPairingCode(normalized);
    console.log(`[whatsapp] Código de pareamento gerado para ${normalized} — digite no celular em até 5 minutos.`);
    return code;
  }

  async connect(manual = false) {
    if (this.status === 'connecting' || this.status === 'connected') return;
    if (manual) {
      this.manualReconnect = true;
      this.consecutiveFailures = 0;
      this.reconnectDelayMs = 15000;
    }

    // Clear any existing reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Safely cleanup old socket listeners if re-connecting
    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners();
        this.sock.end(undefined);
      } catch (e) {
        /* ignore */
      }
      this.sock = null;
    }

    this.status = 'connecting';
    this.emitStatus();

    try {
      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      const { version } = await fetchLatestBaileysVersion();

      this.sock = makeWASocket({
        version,
        browser: Browsers.macOS('Chrome'),
        auth: state,
        logger: pino({ level: 'fatal' }),
        printQRInTerminal: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
      });

      this.sock.ev.on('creds.update', saveCreds);

      // Rastreia acks reais (messages.update) para confirmar entrega de verdade.
      // Sem isso, Baileys resolve ao escrever no socket mesmo que o WhatsApp nunca receba.
      this.sock.ev.on('messages.update', (updates) => {
        for (const { key, update } of updates || []) {
          if (!key || !key.id) continue;
          if (key.fromMe === false) continue;
          const status = update && update.status;
          if (typeof status === 'undefined' || status === null) continue;
          const pending = this.pendingAcks.get(key.id);
          if (!pending) continue;
          // Ignora PENDING (1) - é apenas o primeiro update ao escrever no socket.
          // Aguarda SERVER_ACK (2) ou superior para confirmar entrega.
          if (status === proto.WebMessageInfo.Status.PENDING) {
            continue;
          }
          clearTimeout(pending.timer);
          this.pendingAcks.delete(key.id);
          // Rejeita apenas em ERROR (0), resolve em SERVER_ACK (2) ou superior.
          if (status === proto.WebMessageInfo.Status.ERROR) {
            pending.reject(new Error(`WhatsApp não confirmou a mensagem (ack status ${status}).`));
          } else {
            pending.resolve(status);
          }
        }
      });

      // Handler para messages.upsert: captura acks de auto-envio (fromMe:true)
      // que chegam via 'append' type quando a mensagem volta para o próprio chat.
      this.sock.ev.on('messages.upsert', (upsert) => {
        if (upsert.type !== 'append' || !upsert.messages) return;
        for (const msg of upsert.messages) {
          const key = msg.key;
          if (!key || !key.id || key.fromMe !== true) continue;
          const status = msg.status;
          if (typeof status === 'undefined' || status === null) continue;
          const pending = this.pendingAcks.get(key.id);
          if (!pending) continue;
          // Ignora PENDING (1) - aguarda SERVER_ACK (2) ou superior.
          if (status === proto.WebMessageInfo.Status.PENDING) {
            continue;
          }
          clearTimeout(pending.timer);
          this.pendingAcks.delete(key.id);
          // Rejeita apenas em ERROR (0), resolve em SERVER_ACK (2) ou superior.
          if (status === proto.WebMessageInfo.Status.ERROR) {
            pending.reject(new Error(`WhatsApp não confirmou a mensagem (ack status ${status}).`));
          } else {
            pending.resolve(status);
          }
        }
      });

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.qrDataUrl = await QRCode.toDataURL(qr);
          this.status = 'qr';
          this.lastQrTime = Date.now();
          // Janela de pareamento: preserva ciclo rápido de reconexão enquanto
          // o QR está em tela (o usuário pode estar escaneando agora).
          this.pairingWindowUntil = Date.now() + 5 * 60 * 1000;
          this.emitStatus();
        }

        if (connection === 'open') {
          this.status = 'connected';
          this.qrDataUrl = null;
          this.phoneNumber = this.sock.user?.id?.split(':')[0] || null;
          this.reconnectDelayMs = 15000;
          this.consecutiveFailures = 0;
          this.sessionEstablished = true;
          this.manualReconnect = false;
          this.emitStatus();
          // Processar fila ao conectar
          if (this.queue) {
            console.log('[whatsapp] Conectado — processando fila de mensagens...');
            this.queue._processNext();
          }
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut;
          const closeReason = lastDisconnect?.error?.message || '';
          // QR refs esgotados = WhatsApp rate-limitou novas tentativas de pareamento.
          // Não adianta reconectar em loop: precisa de cooldown longo.
          const qrRefsEnded = /QR refs attempts ended/i.test(closeReason);
          console.log(`[whatsapp] Conexão fechada — statusCode: ${statusCode} — isLoggedOut: ${isLoggedOut} — qrRefsEnded: ${qrRefsEnded} — msg: ${String(closeReason).slice(0, 160)}`);
          this.disconnectCount++;
          this.consecutiveFailures++;
          this.lastStatusCode = statusCode;

          this.status = 'disconnected';
          this.qrDataUrl = null;
          this.phoneNumber = null;
          this.emitStatus();

          // Safely remove listeners from closed socket
          if (this.sock) {
            try { this.sock.ev.removeAllListeners(); } catch (e) {}
            this.sock = null;
          }

          if (isLoggedOut && this.sessionEstablished) {
            console.log('[whatsapp] Sessão inválida (loggedOut) após sessão estabelecida — limpando credenciais...');
            this.sessionEstablished = false;
            try {
              if (fs.existsSync(AUTH_DIR)) {
                const files = fs.readdirSync(AUTH_DIR);
                for (const file of files) {
                  fs.unlinkSync(path.join(AUTH_DIR, file));
                }
              }
            } catch (e) {
              console.error('[whatsapp] Erro ao limpar wa-auth:', e.message);
            }
            this.consecutiveFailures = 0;
            this.reconnectDelayMs = 15000;
            this.reconnectTimer = setTimeout(() => this.connect(), 15000);
          } else if (isLoggedOut) {
            // 401 numa sessão que NUNCA conectou (pareamento parcial/envenenado).
            // Reaproveitar esse estado gera 401 determinístico em loop.
            // Documentação oficial: 401 exige sessão fresca → backup + pasta vazia.
            try {
              const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
              const backupDir = `${AUTH_DIR}-partial-${stamp}`;
              if (fs.existsSync(AUTH_DIR)) {
                fs.renameSync(AUTH_DIR, backupDir);
              }
              fs.mkdirSync(AUTH_DIR, { recursive: true });
              console.log(`[whatsapp] 401 sem sessão estabelecida — auth parcial arquivado em ${backupDir}, recomeçando do zero.`);
            } catch (e) {
              console.error('[whatsapp] Erro ao rotacionar wa-auth parcial:', e.message);
            }
            this.reconnectDelayMs = 15000;
            const inWindow = Date.now() < this.pairingWindowUntil;
            this.reconnectTimer = setTimeout(() => this.connect(), inWindow ? 5000 : 15000);
          } else if (statusCode === DisconnectReason.restartRequired) {
            // 515 "restart required" = fluxo NORMAL pós-pareamento: o servidor
            // aceitou a vinculação e pede reconexão IMEDIATA para completar o login.
            // Esperar demais faz o registro pendente expirar → 401 Connection Failure.
            console.log('[whatsapp] Restart requerido pelo servidor — reconectando em 2s (completando login pós-pareamento).');
            this.reconnectDelayMs = 15000;
            this.reconnectTimer = setTimeout(() => this.connect(), 2000);
          } else if (qrRefsEnded && Date.now() < this.pairingWindowUntil) {
            // QR refs esgotaram DURANTE a janela de pareamento (código emitido / QR em tela).
            // Cooldown de 10min mataria o pareamento: reconexão rápida + fluxo de
            // registro limpo, para o usuário gerar um novo código imediatamente.
            this.stripPairingCodeCreds();
            console.log('[whatsapp] QR refs esgotados durante janela de pareamento — reconectando em 3s (gere novo código).');
            this.reconnectTimer = setTimeout(() => this.connect(), 3000);
          } else if (qrRefsEnded) {
            // WhatsApp bloqueou novas tentativas de QR por excesso de tentativas.
            // Cooldown longo (10 min) para não piorar o rate-limit.
            console.log('[whatsapp] QR rate-limit atingido — aguardando 10min antes de tentar de novo.');
            this.reconnectDelayMs = 600000;
            this.reconnectTimer = setTimeout(() => this.connect(), 600000);
          } else if (this.consecutiveFailures >= 10 && !this.manualReconnect && Date.now() >= this.pairingWindowUntil) {
            // Circuit breaker: após 10 falhas seguidas, para de reconectar sozinho.
            console.log('[whatsapp] Circuit breaker: 10 falhas seguidas — reconexão automática pausada. Use "Conectar" no painel.');
            this.status = 'failed';
            this.emitStatus();
          } else if (Date.now() < this.pairingWindowUntil) {
            // Janela de pareamento ativa (QR em tela ou código emitido):
            // reconexão rápida preserva o pareamento em andamento.
            console.log('[whatsapp] Janela de pareamento ativa — reconectando em 5s.');
            this.reconnectTimer = setTimeout(() => this.connect(), 5000);
          } else {
            // Backoff exponencial com base maior (15s → 30s → 60s ... máx 5min).
            const sinceQr = Date.now() - (this.lastQrTime || 0);
            const qrCooldown = this.lastQrTime ? Math.max(0, 90000 - sinceQr) : 0;
            const delay = Math.max(
              Math.min(this.reconnectDelayMs, 300000),
              qrCooldown,
            );
            this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, 300000);
            console.log(`[whatsapp] Reconectando em ${Math.round(delay / 1000)}s (backoff, falhas seguidas: ${this.consecutiveFailures})`);
            this.reconnectTimer = setTimeout(() => this.connect(), delay);
          }
        }
      });
    } catch (err) {
      console.error('[whatsapp] Erro ao conectar:', err.message);
      this.status = 'disconnected';
      this.emitStatus();
    }
  }

  async disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners();
        await this.sock.logout();
      } catch (e) { /* ignore */ }
      this.sock = null;
    }
    this.sessionEstablished = false;
    this.status = 'disconnected';
    this.qrDataUrl = null;
    this.phoneNumber = null;
    this.emitStatus();
  }

  getStatus() {
    return {
      status: this.status,
      qr: this.qrDataUrl,
      phoneNumber: this.phoneNumber,
      disconnectCount: this.disconnectCount,
      consecutiveFailures: this.consecutiveFailures,
      lastStatusCode: this.lastStatusCode,
      pendingAcks: this.pendingAcks.size,
      socketUsable: this.isSocketUsable(),
    };
  }

  // Envia e aguarda ack real do servidor (SERVER_ACK ou superior).
  // Gabarito de "enviado com sucesso": WhatsApp confirmou, não apenas socket abriu.
  async sendMessage(phone, text) {
    if (this.status !== 'connected' || !this.sock) {
      throw new Error('WhatsApp não está conectado.');
    }
    if (!this.isSocketUsable()) {
      throw new Error('WhatsApp não está conectado (socket indisponível).');
    }
    const normalized = normalizePhone(phone);
    if (!normalized) throw new Error('Telefone inválido.');
    const jid = `${normalized}@s.whatsapp.net`;
    let result;
    try {
      result = await this.sock.sendMessage(jid, { text });
    } catch (err) {
      // Captura o erro real do Baileys para não mascarar como "enviado"
      console.error('[whatsapp] Falha ao enviar mensagem para', jid, '—', err.message);
      throw err;
    }
    const msgId = result && result.key && result.key.id;
    if (!msgId) {
      return result;
    }
    const status = await this.waitForAck(msgId);
    return { ...result, ackStatus: status };
  }

  waitForAck(msgId, timeoutMs = null) {
    const timeout = timeoutMs || this.ackTimeoutMs;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingAcks.delete(msgId);
        reject(new Error('Sem confirmação do WhatsApp (timeout ack).'));
      }, timeout);
      this.pendingAcks.set(msgId, { resolve, reject, timer });
    });
  }
}

module.exports = WhatsAppService;