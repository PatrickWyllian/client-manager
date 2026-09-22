const db = require('../db/database');
const { EventEmitter } = require('events');
const { recordNotification } = require('./scheduler');

const MAX_ATTEMPTS = 3;
const STALE_MS = 30 * 60 * 1000;

/**
 * Spintax parser: replaces {option1|option2|option3} with a random choice
 */
function parseSpintax(text) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(/\{([^{}]+)\}/g, (match, choices) => {
    const options = choices.split('|');
    return options[Math.floor(Math.random() * options.length)];
  });
}

/**
 * Business hours check (08:00 to 20:00)
 */
function isBusinessHours() {
  const hour = new Date().getHours();
  return hour >= 8 && hour < 20;
}

class MessageQueue extends EventEmitter {
  constructor(waService, io) {
    super();
    this.waService = waService;
    this.io = io;
    this.processing = false;
    this.defaultIntervalMs = 2 * 60 * 1000; // 2 minutos (envios individuais)
    this.cronIntervalMs = 5 * 60 * 1000; // 5 minutos (cron/recuperação)
    this.timer = null;
  }

  start() {
    if (this.timer) return;
    this._processNext();
  }

  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.processing = false;
  }

  async _processNext() {
    if (this.processing) return;

    // Recupera filas presas em 'sending' (processo caiu antes do ack/timeout)
    // e as devolve a 'pending' para nova tentativa (com limite de attempts).
    db.prepare(`
      UPDATE message_queue
      SET status = 'pending'
      WHERE status = 'sending'
        AND (attempts IS NULL OR attempts < ?)
        AND datetime(created_at) < datetime('now', 'localtime', ?
      )
    `).run(MAX_ATTEMPTS, `-${Math.floor(STALE_MS / 60000)} minutes`);

    // Se estiver fora do horário comercial para envios automáticos, aguardar
    if (!isBusinessHours()) {
      console.log('[messageQueue] Fora do horário comercial (08h–20h). Fila pausada até as 08:00.');
      this.timer = setTimeout(() => this._processNext(), 15 * 60 * 1000); // Tentar novamente em 15min
      return;
    }

    const pending = db.prepare(
      "SELECT * FROM message_queue WHERE status = 'pending' ORDER BY priority DESC, created_at ASC LIMIT 1"
    ).get();

    if (!pending) {
      this.timer = null;
      this.emit('queue:empty');
      return;
    }

    this.processing = true;
    this.emit('queue:processing', pending);

    // Marca como 'sending' para não re-pescar a mesma mensagem enquanto enviamos
    db.prepare(
      "UPDATE message_queue SET status = 'sending' WHERE id = ?"
    ).run(pending.id);

    let nextDelayMs = this.defaultIntervalMs;

    try {
      if (this.waService.getStatus().status !== 'connected') {
        // Devolve para 'pending' e tenta de novo em instantes
        db.prepare(
          "UPDATE message_queue SET status = 'pending' WHERE id = ?"
        ).run(pending.id);
        this.processing = false;
        this.timer = setTimeout(() => this._processNext(), 10000);
        return;
      }

      // Aplica Spintax nas mensagens para variação anti-spam
      const finalMessage = parseSpintax(pending.message);

      // sendMessage agora aguarda o ACK real do servidor (SERVER_ACK+).
      // Se o WhatsApp não confirmar, lança erro e NÃO marcamos como enviada.
      await this.waService.sendMessage(pending.phone, finalMessage);

      db.prepare(
        "UPDATE message_queue SET status = 'sent', sent_at = datetime('now', 'localtime'), attempts = COALESCE(attempts, 0) + 1 WHERE id = ?"
      ).run(pending.id);

      // Registra a notificação somente após o envio CONFIRMADO,
      // para que a cron não re-envie (e sem dar falso "enviada" antes da hora).
      if (pending.client_id) {
        const client = db.prepare("SELECT due_date FROM clients WHERE id = ?").get(pending.client_id);
        if (client) recordNotification(pending.client_id, client.due_date, pending.type);
      }

      this.emit('queue:sent', pending);

      // Emitir via Socket.IO para o frontend saber que a mensagem foi entregue
      if (this.io) {
        // Buscar nome do cliente se tiver client_id
        let clientName = pending.phone;
        if (pending.client_id) {
          const client = db.prepare("SELECT name FROM clients WHERE id = ?").get(pending.client_id);
          if (client) clientName = client.name;
        }
        this.io.emit('wa:message-sent', {
          id: pending.id,
          client_id: pending.client_id,
          clientName,
          phone: pending.phone,
          type: pending.type
        });
        this.io.emit('wa:queue-update', this.getQueueStatus());
      }
    } catch (err) {
      console.error('[messageQueue] Erro ao enviar mensagem:', err.message);

      const attempts = (pending.attempts || 0) + 1;

      // Envio não confirmado: tenta de novo (com limite), sem dar falso "enviada".
      if (attempts < MAX_ATTEMPTS) {
        db.prepare(
          "UPDATE message_queue SET status = 'pending', attempts = ? WHERE id = ?"
        ).run(attempts, pending.id);
        console.log(`[messageQueue] Reenfileirando (attempt ${attempts}/${MAX_ATTEMPTS}): ${pending.phone}`);
        this.emit('queue:requeued', { ...pending, attempts });
      } else {
        db.prepare(
          "UPDATE message_queue SET status = 'error', error = ?, attempts = ? WHERE id = ?"
        ).run(err.message, attempts, pending.id);

        this.emit('queue:error', { ...pending, error: err.message });

        if (this.io) {
          let clientName = pending.phone;
          if (pending.client_id) {
            const client = db.prepare("SELECT name FROM clients WHERE id = ?").get(pending.client_id);
            if (client) clientName = client.name;
          }
          this.io.emit('wa:message-error', {
            id: pending.id,
            client_id: pending.client_id,
            clientName,
            phone: pending.phone,
            type: pending.type,
            error: err.message
          });
          this.io.emit('wa:queue-update', this.getQueueStatus());
        }
      }
    } finally {
      this.processing = false;
      const isCron = pending.type === 'reminder' || pending.type === 'recovery' || pending.type === 'post_expiry';
      const baseDelay = isCron ? this.cronIntervalMs : this.defaultIntervalMs;
      
      // Jitter humano: variação aleatória entre 15s e 45s
      const jitterMs = Math.floor(Math.random() * (45000 - 15000 + 1)) + 15000;
      nextDelayMs = baseDelay + jitterMs;

      this.timer = setTimeout(() => this._processNext(), nextDelayMs);
    }
  }

  enqueue(phone, message, type = 'manual', clientId = null, priority = 0) {
    const result = db.prepare(
      "INSERT INTO message_queue (client_id, phone, message, type, priority, scheduled_at) VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))"
    ).run(clientId, phone, message, type, priority);

    this.emit('queue:added', { id: result.lastInsertRowid, phone, message, type });

    if (this.io) {
      this.io.emit('wa:queue-update', this.getQueueStatus());
    }

    this._processNext();

    return result.lastInsertRowid;
  }

  cancel(id) {
    db.prepare(
      "UPDATE message_queue SET status = 'cancelled' WHERE id = ? AND status IN ('pending', 'sending')"
    ).run(id);

    this.emit('queue:cancelled', id);

    if (this.io) {
      this.io.emit('wa:queue-update', this.getQueueStatus());
    }
  }

  forceCancel(id) {
    db.prepare(
      "UPDATE message_queue SET status = 'cancelled' WHERE id = ? AND status NOT IN ('sent', 'cancelled', 'error')"
    ).run(id);

    this.emit('queue:cancelled', id);

    if (this.io) {
      this.io.emit('wa:queue-update', this.getQueueStatus());
    }
  }

  cancelAll() {
    db.prepare(
      "UPDATE message_queue SET status = 'cancelled' WHERE status IN ('pending', 'sending')"
    ).run();

    this.emit('queue:cleared');

    if (this.io) {
      this.io.emit('wa:queue-update', this.getQueueStatus());
    }
  }

  getQueueStatus() {
    const pending = db.prepare(
      "SELECT COUNT(*) as count FROM message_queue WHERE status = 'pending'"
    ).get();

    const processing = db.prepare(
      "SELECT * FROM message_queue WHERE status IN ('pending', 'sending') ORDER BY priority DESC, created_at ASC LIMIT 1"
    ).get();

    const stats = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM message_queue
      GROUP BY status
    `).all();

    return {
      pending: pending.count,
      current: processing || null,
      stats: stats.reduce((acc, s) => { acc[s.status] = s.count; return acc; }, {}),
      defaultIntervalMs: this.defaultIntervalMs,
      cronIntervalMs: this.cronIntervalMs,
      processing: this.processing
    };
  }

  getQueue(limit = 50) {
    return db.prepare(`
      SELECT mq.*, c.name as client_name
      FROM message_queue mq
      LEFT JOIN clients c ON c.id = mq.client_id
      WHERE mq.status IN ('pending', 'sending')
      ORDER BY mq.priority DESC, mq.created_at ASC
      LIMIT ?
    `).all(limit);
  }

  getHistory(limit = 50) {
    return db.prepare(`
      SELECT mq.*, c.name as client_name
      FROM message_queue mq
      LEFT JOIN clients c ON c.id = mq.client_id
      WHERE mq.status IN ('sent', 'error', 'cancelled')
      ORDER BY mq.sent_at DESC, mq.created_at DESC
      LIMIT ?
    `).all(limit);
  }

  clearHistory() {
    db.prepare(
      "DELETE FROM message_queue WHERE status IN ('sent', 'error', 'cancelled')"
    ).run();

    if (this.io) {
      this.io.emit('wa:queue-update', this.getQueueStatus());
    }
  }
}

module.exports = MessageQueue;
