import { getVapidPublicKey, subscribePush, unsubscribePush } from '../api/pushApi';

/**
 * Convert VAPID public key base64 string to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if browser supports Push Notifications
 */
export const isPushSupported = () => {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
};

/**
 * Get current push subscription if active
 */
export const getCurrentPushSubscription = async () => {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return await registration.pushManager.getSubscription();
};

/**
 * Request notification permission and subscribe to Web Push
 */
export const subscribeUserToPush = async () => {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported on this browser/device');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted');
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    const res = await getVapidPublicKey();
    const vapidKey = res.data?.data?.publicKey || res.data?.publicKey;

    if (!vapidKey) {
      throw new Error('Could not retrieve VAPID key from server');
    }

    const convertedVapidKey = urlBase64ToUint8Array(vapidKey);
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey,
    });
  }

  // Send subscription to server
  const subJSON = subscription.toJSON();
  await subscribePush({
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subJSON.keys?.p256dh,
      auth: subJSON.keys?.auth,
    },
  });

  return subscription;
};

/**
 * Unsubscribe user from Web Push
 */
export const unsubscribeUserFromPush = async () => {
  if (!isPushSupported()) return false;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    await unsubscribePush(subscription.endpoint).catch(() => {});
    await subscription.unsubscribe();
  }

  return true;
};
