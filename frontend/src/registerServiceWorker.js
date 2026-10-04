/**
 * Progressive Web App Service Worker registration helper
 */

export const registerServiceWorker = async () => {
  if (
    'serviceWorker' in navigator &&
    (import.meta.env.PROD ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1')
  ) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // New content is available, notify via custom event if desired
              window.dispatchEvent(new CustomEvent('uniconnect-sw-updated'));
            }
          }
        });
      });

      return registration;
    } catch (error) {
      console.warn('[SW] Registration failed:', error.message);
    }
  }
  return null;
};
