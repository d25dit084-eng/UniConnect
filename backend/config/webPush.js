const webpush = require('web-push');
const logger = require('../utils/logger');

// Generate or load stable VAPID keys
let publicKey = process.env.VAPID_PUBLIC_KEY;
let privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || 'mailto:support@uniconnect.edu';

if (!publicKey || !privateKey) {
  // Use stable development VAPID keys or generate on the fly
  const generated = webpush.generateVAPIDKeys();
  publicKey = generated.publicKey;
  privateKey = generated.privateKey;
  logger.info('[WebPush] Using generated development VAPID keys');
}

try {
  webpush.setVapidDetails(subject, publicKey, privateKey);
} catch (err) {
  logger.warn('[WebPush] Failed to configure VAPID details:', err.message);
}

module.exports = {
  webpush,
  getPublicKey: () => publicKey,
};
