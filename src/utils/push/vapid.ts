/**
 * Client-side Web Push VAPID Utilities & Registration Helpers
 */

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerPushNotifications(): Promise<PushSubscription | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Web Push is not supported in this browser environment.');
    return null;
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    console.error('VAPID public key not configured in environment.');
    return null;
  }

  try {
    // Register standalone push companion service worker
    const registration = await navigator.serviceWorker.register('/sw-push.js', {
      scope: '/',
    });
    
    // Wait until the service worker is active
    await navigator.serviceWorker.ready;

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey as unknown as ArrayBuffer,
      });
    }

    // Register this subscription with Next.js subscribe API
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subscription }),
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Failed to register subscription on server.');
    }

    return subscription;
  } catch (err: unknown) {
    console.error('Error during client push registration:', err);
    throw err;
  }
}

export async function unsubscribePushNotifications(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw-push.js');
    if (!registration) return false;

    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      console.info('Unsubscribed browser push endpoint.');
      return true;
    }
    return false;
  } catch (err: unknown) {
    console.warn('Error unsubscribing browser push endpoint:', err);
    return false;
  }
}
