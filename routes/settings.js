const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { restartScheduler } = require('../services/scheduler');

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
      recovery_interval_minutes,
      post_expiry_days,
      reminder_schedule_hour,
      reminder_schedule_minute,
      reminder_schedule_enabled,
      post_expiry_schedule_hour,
      post_expiry_schedule_minute,
      post_expiry_schedule_enabled,
      recovery_schedule_hour,
      recovery_schedule_minute,
      recovery_schedule_enabled
    } = req.body;
    const upsert = db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    );
    if (reminder_days_before !== undefined) upsert.run('reminder_days_before', String(reminder_days_before));
    if (reminder_message_template !== undefined) upsert.run('reminder_message_template', reminder_message_template);
    if (welcome_message_template !== undefined) upsert.run('welcome_message_template', welcome_message_template);
    if (renewal_message_template !== undefined) upsert.run('renewal_message_template', renewal_message_template);
    if (recovery_message_template !== undefined) upsert.run('recovery_message_template', recovery_message_template);
    if (post_expiry_message_template !== undefined) upsert.run('post_expiry_message_template', post_expiry_message_template);
    if (recovery_days_after_expiry !== undefined) upsert.run('recovery_days_after_expiry', String(recovery_days_after_expiry));
    if (recovery_batch_size !== undefined) upsert.run('recovery_batch_size', String(recovery_batch_size));
    if (recovery_interval_minutes !== undefined) upsert.run('recovery_interval_minutes', String(recovery_interval_minutes));
    if (post_expiry_days !== undefined) upsert.run('post_expiry_days', String(post_expiry_days));

    let scheduleChanged = false;
    if (reminder_schedule_hour !== undefined) { upsert.run('reminder_schedule_hour', String(reminder_schedule_hour)); scheduleChanged = true; }
    if (reminder_schedule_minute !== undefined) { upsert.run('reminder_schedule_minute', String(reminder_schedule_minute)); scheduleChanged = true; }
    if (reminder_schedule_enabled !== undefined) { upsert.run('reminder_schedule_enabled', String(reminder_schedule_enabled)); scheduleChanged = true; }
    if (post_expiry_schedule_hour !== undefined) { upsert.run('post_expiry_schedule_hour', String(post_expiry_schedule_hour)); scheduleChanged = true; }
    if (post_expiry_schedule_minute !== undefined) { upsert.run('post_expiry_schedule_minute', String(post_expiry_schedule_minute)); scheduleChanged = true; }
    if (post_expiry_schedule_enabled !== undefined) { upsert.run('post_expiry_schedule_enabled', String(post_expiry_schedule_enabled)); scheduleChanged = true; }
    if (recovery_schedule_hour !== undefined) { upsert.run('recovery_schedule_hour', String(recovery_schedule_hour)); scheduleChanged = true; }
    if (recovery_schedule_minute !== undefined) { upsert.run('recovery_schedule_minute', String(recovery_schedule_minute)); scheduleChanged = true; }
    if (recovery_schedule_enabled !== undefined) { upsert.run('recovery_schedule_enabled', String(recovery_schedule_enabled)); scheduleChanged = true; }

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
