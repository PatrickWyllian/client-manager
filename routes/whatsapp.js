const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { buildRecoveryMessage, buildPostExpiryMessage } = require('../services/scheduler');
const { daysSince } = require('../lib/dateHelpers');

module.exports = (waService, messageQueue) => {
  router.get('/status', (req, res) => {
    res.json(waService.getStatus());
  });

  router.post('/connect', async (req, res) => {
    try {
      await waService.connect();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/disconnect', async (req, res) => {
    try {
      await waService.disconnect();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/test-message', async (req, res) => {
    try {
      const { phone, message } = req.body;
      if (!phone || !message) return res.status(400).json({ error: 'phone e message são obrigatórios.' });

      const id = messageQueue.enqueue(phone, message, 'manual');
      res.json({ ok: true, queueId: id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Enviar mensagem de recuperação para um cliente específico
  router.post('/send-recovery', async (req, res) => {
    try {
      const { client_id } = req.body;
      if (!client_id) return res.status(400).json({ error: 'client_id é obrigatório.' });

      if (waService.getStatus().status !== 'connected') {
        return res.status(400).json({ error: 'WhatsApp não está conectado.' });
      }

      const client = db.prepare(`
        SELECT c.*, s.name AS server_name
        FROM clients c
        LEFT JOIN servers s ON s.id = c.server_id
        WHERE c.id = ?
      `).get(client_id);

      if (!client) return res.status(404).json({ error: 'Cliente não encontrado.' });

      const expiredDays = daysSince(client.due_date);

      // < 30 dias: template pós-vencimento | >= 30 dias: template de recuperação
      const isRecovery = expiredDays >= 30;
      const message = isRecovery
        ? buildRecoveryMessage(client)
        : buildPostExpiryMessage(client);
      const msgType = isRecovery ? 'recovery' : 'post_expiry';

      messageQueue.enqueue(client.phone, message, msgType, client.id, 1);

      res.json({ ok: true, client: client.name, days_expired: expiredDays, type: msgType });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ========== FILA DE MENSAGENS ==========

  // Status da fila
  router.get('/queue/status', (req, res) => {
    res.json(messageQueue.getQueueStatus());
  });

  // Listar mensagens na fila
  router.get('/queue', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    res.json(messageQueue.getQueue(limit));
  });

  // Histórico de mensagens
  router.get('/queue/history', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    res.json(messageQueue.getHistory(limit));
  });

  // Adicionar mensagem à fila manualmente
  router.post('/queue', (req, res) => {
    try {
      const { phone, message, client_id, type, priority } = req.body;
      if (!phone || !message) {
        return res.status(400).json({ error: 'phone e message são obrigatórios.' });
      }

      if (waService.getStatus().status !== 'connected') {
        return res.status(400).json({ error: 'WhatsApp não está conectado.' });
      }

      const id = messageQueue.enqueue(
        phone, message, type || 'manual', client_id || null, priority || 0
      );
      res.json({ ok: true, queueId: id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Cancelar mensagem na fila
  router.post('/queue/:id/cancel', (req, res) => {
    messageQueue.cancel(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // Cancelar todas as pendentes
  router.post('/queue/cancel-all', (req, res) => {
    messageQueue.cancelAll();
    res.json({ ok: true });
  });

  // Limpar histórico
  router.post('/queue/clear-history', (req, res) => {
    messageQueue.clearHistory();
    res.json({ ok: true });
  });

  // Enviar mensagem para vários clientes (batch)
  router.post('/queue/batch', (req, res) => {
    try {
      const { client_ids, message, type } = req.body;

      if (!client_ids || !Array.isArray(client_ids) || client_ids.length === 0) {
        return res.status(400).json({ error: 'client_ids deve ser um array não vazio.' });
      }

      if (!message) {
        return res.status(400).json({ error: 'message é obrigatório.' });
      }

      if (waService.getStatus().status !== 'connected') {
        return res.status(400).json({ error: 'WhatsApp não está conectado.' });
      }

      let added = 0;
      for (const clientId of client_ids) {
        const client = db.prepare(`
          SELECT c.*, s.name AS server_name
          FROM clients c
          LEFT JOIN servers s ON s.id = c.server_id
          WHERE c.id = ?
        `).get(clientId);

        if (client && client.phone) {
          const personalizedMessage = message
            .replace(/{nome}/g, client.name)
            .replace(/{servidor}/g, client.server_name || client.plan || '')
            .replace(/{telefone}/g, client.phone || '');

          messageQueue.enqueue(client.phone, personalizedMessage, type || 'batch', client.id);
          added++;
        }
      }

      res.json({ ok: true, added });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
