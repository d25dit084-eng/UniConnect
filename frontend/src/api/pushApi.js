import api from './axios';

/**
 * Fetch VAPID public key
 */
export const getVapidPublicKey = () => api.get('/notifications/push/vapid-key');

/**
 * Register push subscription on server
 */
export const subscribePush = (subscriptionData) =>
  api.post('/notifications/push/subscribe', subscriptionData);

/**
 * Unsubscribe push subscription from server
 */
export const unsubscribePush = (endpoint) =>
  api.post('/notifications/push/unsubscribe', { endpoint });
