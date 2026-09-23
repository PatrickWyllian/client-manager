const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const db = require('../db/database');
const { createChildLogger } = require('../lib/logger');

const logger = createChildLogger('backup');

const DB_PATH = path.join(__dirname, '..', 'data', 'iptv-crm.db');
const BACKUP_DIR = path.join(__dirname, '..', 'data', 'backups');

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function runBackup() {
  try {
    ensureBackupDir();
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const backupFileName = `backup-${timestamp}.db`;
    const targetPath = path.join(BACKUP_DIR, backupFileName);

    // SQLite backup command safely via better-sqlite3 API
    db.backup(targetPath)
      .then(() => {
        logger.info({ backupFile: backupFileName }, 'Backup realizado com sucesso');
        cleanOldBackups(30); // Keep last 30 backups
      })
      .catch((err) => {
        logger.error({ err: err.message }, 'Erro durante o backup');
      });
  } catch (err) {
    logger.error({ err: err.message }, 'Erro ao iniciar backup');
  }
}

function cleanOldBackups(maxKeep = 30) {
  try {
    ensureBackupDir();
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
      .map(f => ({ name: f, path: path.join(BACKUP_DIR, f), time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);

    if (files.length > maxKeep) {
      const toDelete = files.slice(maxKeep);
      for (const item of toDelete) {
        fs.unlinkSync(item.path);
      }
    }
  } catch (err) {
    logger.error({ err: err.message }, 'Erro ao limpar backups antigos');
  }
}

function startAutoBackup() {
  // Run backup daily at 03:00 AM
  cron.schedule('0 3 * * *', () => {
    logger.info('Executando rotina diária de backup');
    runBackup();
  });
  logger.info('Rotina de backup diário agendada para as 03:00.');
}

module.exports = {
  startAutoBackup,
  runBackup,
};
