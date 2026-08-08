const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const db = require('../db/database');

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
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup-${timestamp}.db`;
    const targetPath = path.join(BACKUP_DIR, backupFileName);

    // SQLite backup command safely via better-sqlite3 API
    db.backup(targetPath)
      .then(() => {
        console.log(`[backup] Backup realizado com sucesso: ${backupFileName}`);
        cleanOldBackups(30); // Keep last 30 backups
      })
      .catch((err) => {
        console.error('[backup] Erro durante o backup:', err.message);
      });
  } catch (err) {
    console.error('[backup] Erro ao iniciar backup:', err.message);
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
    console.error('[backup] Erro ao limpar backups antigos:', err.message);
  }
}

function startAutoBackup() {
  // Run backup daily at 03:00 AM
  cron.schedule('0 3 * * *', () => {
    console.log('[backup] Executando rotina diária de backup...');
    runBackup();
  });
  console.log('[backup] Rotina de backup diário agendada para as 03:00.');
}

module.exports = {
  startAutoBackup,
  runBackup
};
