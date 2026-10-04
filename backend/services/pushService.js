const { webpush } = require('../config/webPush');
const PushSubscription = require('../models/PushSubscription');
const logger = require('../utils/logger');

/**
 * Send Web Push notification to all active devices of a user
 * @param {string|ObjectId} userId
 * @param {object} payload - { title, body, url, icon }
 */
const sendPushNotification = async (userId, payload) => {
  try {
    const subscriptions = await PushSubscription.find({ user: userId });
    if (!subscriptions || subscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const notificationPayload = JSON.stringify({
      title: payload.title || 'UniConnect Notification',
      body: payload.body || 'You have a new update',
      url: payload.url || '/notifications',
      icon: payload.icon || '/favicon.svg',
    });

    let sent = 0;
    let failed = 0;

    const promises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSubscription, notificationPayload);
        sent += 1;
      } catch (err) {
        failed += 1;
        // If subscription is expired or unsubscribed, remove from database
        if (err.statusCode === 410 || err.statusCode === 404) {
          logger.info('[WebPush] Removing expired push subscription:', {
            id: sub._id,
            status: err.statusCode,
          });
          await PushSubscription.findByIdAndDelete(sub._id).catch(() => {});
        } else {
          logger.warn('[WebPush] Error sending push notification:', {
            error: err.message,
            statusCode: err.statusCode,
          });
        }
      }
    });

    await Promise.all(promises);
    return { sent, failed };
  } catch (error) {
    logger.error('[WebPush] Service error:', { error: error.message });
    return { sent: 0, failed: 0, error: error.message };
  }
};

module.exports = {
  sendPushNotification,
};
