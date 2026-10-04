const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const SECRET =
  process.env.AUDIT_ENCRYPTION_KEY ||
  process.env.JWT_SECRET ||
  'uniconnect-master-audit-encryption-key-2026';

// Derive deterministic 32-byte key from SECRET
const KEY = crypto.scryptSync(SECRET, 'uniconnect-audit-salt-gcm', 32);

/**
 * Encrypt a string using AES-256-GCM.
 * @param {string} text - Plain text to encrypt
 * @returns {string} Hex-encoded string in format: iv:tag:ciphertext
 */
const encryptAuthor = (text) => {
  if (!text) return null;
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text.toString(), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
};

/**
 * Decrypt a string using AES-256-GCM.
 * @param {string} encryptedString - Hex-encoded string in format: iv:tag:ciphertext
 * @returns {string} Plain text
 */
const decryptAuthor = (encryptedString) => {
  if (!encryptedString) return null;
  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format');
  }
  const [ivHex, tagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

module.exports = {
  encryptAuthor,
  decryptAuthor,
};
