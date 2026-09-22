const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys');
const { proto } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const { normalizePhone } = require('../lib/validators');

const AUTH_DIR = path.join(__dirname, '..', 'data', 'wa-auth');

// janela máxima para aguardar confirmação (ack) do servidor após o envio
const ACK_TIMEOUT_MS = 45000;

class WhatsAppService {
  constructor(io) {
    this.io = io;
    this.sock = null;
    this.status = 'disconnected'; // disconnected | connecting | qr | connected
    this.qrDataUrl = null;
    this.phoneNumber = null;
    this.queue = null;
    this.reconnectTimer = null;
    this.reconnectDelayMs = 5000;
    this.disconnectCount = 0;
    this.lastStatusCode = null;
    this.pendingAcks = new Map(); // messageId -> { resolve, reject, timer }
  }

  setQueue(queue) {
    this.queue = queue;
  }

  emitStatus() {
    this.io.emit('wa:status', {
      status: this.status,
      qr: this.qrDataUrl,
      phoneNumber: this.phoneNumber,
      disconnectCount: this.disconnectCount,
      lastStatusCode: this.lastStatusCode
    });
  }

  isSocketUsable() {
    const ws = this.sock && this.sock.ws;
    return !!ws && ws.readyState === 1; // WebSocket.OPEN
  }

  async connect() {
    if (this.status === 'connecting' || this.status === 'connected') return;

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
        browser: Browsers.ubuntu('Chrome'),
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false
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
          clearTimeout(pending.timer);
          this.pendingAcks.delete(key.id);
          // Só conta como entregue quando o servidor confirma (SERVER_ACK ou superior)
          if (status <= proto.WebMessageInfo.Status.PENDING) {
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
          this.emitStatus();
        }

        if (connection === 'open') {
          this.status = 'connected';
          this.qrDataUrl = null;
          this.phoneNumber = this.sock.user?.id?.split(':')[0] || null;
          this.reconnectDelayMs = 5000;
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
          console.log(`[whatsapp] Conexão fechada — statusCode: ${statusCode} — isLoggedOut: ${isLoggedOut}`);
          this.disconnectCount++;
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

          if (isLoggedOut) {
            console.log('[whatsapp] Sessão inválida (loggedOut) — limpando credenciais...');
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
            this.reconnectTimer = setTimeout(() => this.connect(), 2000);
          } else {
            // Backoff exponencial evita martelar reconexão em sessão instável
            const delay = Math.min(this.reconnectDelayMs, 300000);
            this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, 300000);
            console.log(`[whatsapp] Reconectando em ${Math.round(delay / 1000)}s (backoff)`);
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
      lastStatusCode: this.lastStatusCode,
      pendingAcks: this.pendingAcks.size,
      socketUsable: this.isSocketUsable()
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

  waitForAck(msgId, timeoutMs = ACK_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingAcks.delete(msgId);
        reject(new Error('Sem confirmação do WhatsApp (timeout ack).'));
      }, timeoutMs);
      this.pendingAcks.set(msgId, { resolve, reject, timer });
    });
  }
}

module.exports = WhatsAppService;