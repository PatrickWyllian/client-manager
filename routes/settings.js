const express = require('express');
const router = express.Router();
const db = require('../db/database');

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
    recovery_days_after_expiry,
    recovery_batch_size,
    recovery_interval_minutes
  } = req.body;
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  if (reminder_days_before !== undefined) upsert.run('reminder_days_before', String(reminder_days_before));
  if (reminder_message_template !== undefined) upsert.run('reminder_message_template', reminder_message_template);
  if (welcome_message_template !== undefined) upsert.run('welcome_message_template', welcome_message_template);
  if (renewal_message_template !== undefined) upsert.run('renewal_message_template', renewal_message_template);
  if (recovery_message_template !== undefined) upsert.run('recovery_message_template', recovery_message_template);
  if (recovery_days_after_expiry !== undefined) upsert.run('recovery_days_after_expiry', String(recovery_days_after_expiry));
  if (recovery_batch_size !== undefined) upsert.run('recovery_batch_size', String(recovery_batch_size));
  if (recovery_interval_minutes !== undefined) upsert.run('recovery_interval_minutes', String(recovery_interval_minutes));
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  rows.forEach(r => settings[r.key] = r.value);
  res.json(settings);
});

module.exports = router;
