const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { restartScheduler } = require('../services/scheduler');
const { logAudit } = require('../lib/audit');

module.exports = (waService, io) => {
  router.get('/', (req, res) => {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(r => settings[r.key] = r.value);
    res.json(settings);
  });

  router.put('/', (req, res) => {
    const {
      reminder_days_before,
      reminder_message_template,
      welcome_message_template, renewal_message_template,
      recovery_message_template,
      post_expiry_message_template,
      recovery_days_after_expiry,
      recovery_batch_size,
      post_expiry_days,
      reminder_schedule_hour,
      reminder_schedule_minute,
      reminder_schedule_enabled,
      post_expiry_schedule_hour,
      post_expiry_schedule_minute,
      post_expiry_schedule_enabled,
      recovery_schedule_hour,
      recovery_schedule_minute,
      recovery_schedule_enabled,
      client_data_retention_days,
      message_content_retention_days,
      consent_version,
    } = req.body;
    const upsert = db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    );
    // Rastreia apenas os NOMES das chaves alteradas (valores de template sao
    // ruidosos e podem conter dados de clientes; nao vao para a auditoria).
    const changedKeys = [];
    const setKey = (key, value) => { upsert.run(key, value); changedKeys.push(key); };

    if (reminder_days_before !== undefined) setKey('reminder_days_before', String(reminder_days_before));
    if (reminder_message_template !== undefined) setKey('reminder_message_template', reminder_message_template);
    if (welcome_message_template !== undefined) setKey('welcome_message_template', welcome_message_template);
    if (renewal_message_template !== undefined) setKey('renewal_message_template', renewal_message_template);
    if (recovery_message_template !== undefined) setKey('recovery_message_template', recovery_message_template);
    if (post_expiry_message_template !== undefined) setKey('post_expiry_message_template', post_expiry_message_template);
    if (recovery_days_after_expiry !== undefined) setKey('recovery_days_after_expiry', String(recovery_days_after_expiry));
    if (recovery_batch_size !== undefined) setKey('recovery_batch_size', String(recovery_batch_size));
    if (post_expiry_days !== undefined) setKey('post_expiry_days', String(post_expiry_days));

    // LGPD-11: política de retenção de dados pessoais e versão do consentimento.
    if (client_data_retention_days !== undefined) setKey('client_data_retention_days', String(client_data_retention_days));
    if (message_content_retention_days !== undefined) setKey('message_content_retention_days', String(message_content_retention_days));
    if (consent_version !== undefined) setKey('consent_version', String(consent_version));

    let scheduleChanged = false;
    if (reminder_schedule_hour !== undefined) { setKey('reminder_schedule_hour', String(reminder_schedule_hour)); scheduleChanged = true; }
    if (reminder_schedule_minute !== undefined) { setKey('reminder_schedule_minute', String(reminder_schedule_minute)); scheduleChanged = true; }
    if (reminder_schedule_enabled !== undefined) { setKey('reminder_schedule_enabled', String(reminder_schedule_enabled)); scheduleChanged = true; }
    if (post_expiry_schedule_hour !== undefined) { setKey('post_expiry_schedule_hour', String(post_expiry_schedule_hour)); scheduleChanged = true; }
    if (post_expiry_schedule_minute !== undefined) { setKey('post_expiry_schedule_minute', String(post_expiry_schedule_minute)); scheduleChanged = true; }
    if (post_expiry_schedule_enabled !== undefined) { setKey('post_expiry_schedule_enabled', String(post_expiry_schedule_enabled)); scheduleChanged = true; }
    if (recovery_schedule_hour !== undefined) { setKey('recovery_schedule_hour', String(recovery_schedule_hour)); scheduleChanged = true; }
    if (recovery_schedule_minute !== undefined) { setKey('recovery_schedule_minute', String(recovery_schedule_minute)); scheduleChanged = true; }
    if (recovery_schedule_enabled !== undefined) { setKey('recovery_schedule_enabled', String(recovery_schedule_enabled)); scheduleChanged = true; }

    if (changedKeys.length > 0) {
      logAudit({
        req,
        action: 'settings.update',
        resourceType: 'settings',
        details: { keys: changedKeys, schedule_changed: scheduleChanged },
      });
    }

    if (scheduleChanged) {
      restartScheduler(waService, io);
    }

    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(r => settings[r.key] = r.value);
    res.json(settings);
  });

  return router;
};