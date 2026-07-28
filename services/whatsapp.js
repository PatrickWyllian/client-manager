const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const pino = require('pino');

const AUTH_DIR = path.join(__dirname, '..', 'data', 'wa-auth');

class WhatsAppService {
  constructor(io) {
    this.io = io;
    this.sock = null;
    this.status = 'disconnected'; // disconnected | connecting | qr | connected
    this.qrDataUrl = null;
    this.phoneNumber = null;
    this.queue = null;
  }

  setQueue(queue) {
    this.queue = queue;
  }

  emitStatus() {
    this.io.emit('wa:status', {
      status: this.status,
      qr: this.qrDataUrl,
      phoneNumber: this.phoneNumber
    });
  }

  async connect() {
    if (this.status === 'connecting' || this.status === 'connected') return;
    this.status = 'connecting';
    this.emitStatus();

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

        this.status = 'disconnected';
        this.qrDataUrl = null;
        this.phoneNumber = null;
        this.emitStatus();

        if (isLoggedOut) {
          // Sessão inválida: limpar credenciais antigas e reconectar para gerar novo QR code
          console.log('[whatsapp] Sessão inválida (loggedOut) — limpando credenciais e reconectando...');
          try {
            const files = fs.readdirSync(AUTH_DIR);
            for (const file of files) {
              fs.unlinkSync(path.join(AUTH_DIR, file));
            }
          } catch (e) {
            console.error('[whatsapp] Erro ao limpar wa-auth:', e.message);
          }
          // Pequena pausa antes de reconectar com sessão limpa
          setTimeout(() => this.connect(), 1000);
        } else {
          setTimeout(() => this.connect(), 3000);
        }
      }
    });
  }

  async disconnect() {
    if (this.sock) {
      try { await this.sock.logout(); } catch (e) { /* ignore */ }
      this.sock = null;
    }
    this.status = 'disconnected';
    this.qrDataUrl = null;
    this.phoneNumber = null;
    this.emitStatus();
  }

  getStatus() {
    return { status: this.status, qr: this.qrDataUrl, phoneNumber: this.phoneNumber };
  }

  // Envia mensagem de texto. phone deve estar em formato internacional: 5521999999999
  async sendMessage(phone, text) {
    if (this.status !== 'connected' || !this.sock) {
      throw new Error('WhatsApp não está conectado.');
    }
    const jid = `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
    await this.sock.sendMessage(jid, { text });
  }
}

module.exports = WhatsAppService;
