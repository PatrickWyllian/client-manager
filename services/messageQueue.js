const db = require('../db/database');
const { EventEmitter } = require('events');

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

    try {
      if (this.waService.getStatus().status !== 'connected') {
        this.processing = false;
        this.timer = setTimeout(() => this._processNext(), 10000);
        return;
      }

      const jid = `${pending.phone.replace(/\D/g, '')}@s.whatsapp.net`;
      await this.waService.sock.sendMessage(jid, { text: pending.message });

      db.prepare(
        "UPDATE message_queue SET status = 'sent', sent_at = datetime('now', 'localtime') WHERE id = ?"
      ).run(pending.id);

      this.emit('queue:sent', pending);

      if (this.io) {
        this.io.emit('wa:queue-update', this.getQueueStatus());
      }
    } catch (err) {
      console.error('[messageQueue] Erro ao enviar mensagem:', err.message);
      db.prepare(
        "UPDATE message_queue SET status = 'error', error = ? WHERE id = ?"
      ).run(err.message, pending.id);

      this.emit('queue:error', { ...pending, error: err.message });
    } finally {
      this.processing = false;
      // Cron usa 5 min, demais usam 2 min
      const isCron = pending.type === 'reminder' || pending.type === 'recovery' || pending.type === 'post_expiry';
      const delay = isCron ? this.cronIntervalMs : this.defaultIntervalMs;
      this.timer = setTimeout(() => this._processNext(), delay);
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
      "UPDATE message_queue SET status = 'cancelled' WHERE id = ? AND status = 'pending'"
    ).run(id);

    this.emit('queue:cancelled', id);

    if (this.io) {
      this.io.emit('wa:queue-update', this.getQueueStatus());
    }
  }

  cancelAll() {
    db.prepare(
      "UPDATE message_queue SET status = 'cancelled' WHERE status = 'pending'"
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
      "SELECT * FROM message_queue WHERE status = 'pending' ORDER BY priority DESC, created_at ASC LIMIT 1"
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
      WHERE mq.status IN ('pending', 'processing')
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
