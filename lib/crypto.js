const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const SECRET = process.env.JWT_SECRET || 'iptv-crm-default-fallback-secret-key-32bytes!';

// Ensure 32-byte key derived from SECRET
const KEY = crypto.createHash('sha256').update(SECRET).digest();

/**
 * Encrypt plain text using AES-256-GCM
 * @param {string} text
 * @returns {string} iv:authTag:encryptedHex
 */
function encryptText(text) {
  if (!text) return text;
  // If already encrypted format, return as is
  if (typeof text === 'string' && text.startsWith('enc:v1:')) return text;

  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `enc:v1:${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('[crypto] Erro ao encriptar:', err.message);
    return text;
  }
}

/**
 * Decrypt text if encrypted format (enc:v1:iv:authTag:encrypted)
 * @param {string} encryptedText
 * @returns {string} plain text
 */
function decryptText(encryptedText) {
  if (!encryptedText || typeof encryptedText !== 'string') return encryptedText;
  if (!encryptedText.startsWith('enc:v1:')) return encryptedText; // Legacy unencrypted text

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 5) return encryptedText;

    const iv = Buffer.from(parts[2], 'hex');
    const authTag = Buffer.from(parts[3], 'hex');
    const encrypted = parts[4];

    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[crypto] Erro ao decriptar credencial:', err.message);
    return '***';
  }
}

module.exports = {
  encryptText,
  decryptText
};
