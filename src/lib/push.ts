import { API_BASE } from './api';

/**
 * Returns true if running inside a Capacitor native app (Android/iOS).
 */
function isNative(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
}

/**
 * Sends the FCM token to the backend so the server can send push notifications.
 */
async function sendTokenToServer(userId: number, token: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/accounts/profile/${userId}/push-token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  } catch (err) {
    console.error('[Push] Failed to send token to server:', err);
  }
}

/**
 * Initializes push notifications for a logged-in user.
 * - Requests permission from the OS
 * - Gets the FCM registration token
 * - Sends the token to the backend
 * - Sets up foreground and tap handlers
 *
 * Safe to call in the browser (no-op if not running in Capacitor).
 */
export async function initPushNotifications(userId: number): Promise<void> {
  if (!isNative()) {
    // Not running in a native Capacitor app — skip silently
    return;
  }

  try {
    // Dynamically import so the browser bundle is not affected
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // 1. Check / request permission
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('[Push] Permission not granted');
      return;
    }

    // 2. Register with the native push service (FCM on Android)
    await PushNotifications.register();

    // 3. Listen for the registration token
    PushNotifications.addListener('registration', async (token) => {
      console.log('[Push] FCM token:', token.value);
      await sendTokenToServer(userId, token.value);
    });

    // 4. Handle registration errors
    PushNotifications.addListener('registrationError', (err) => {
      console.error('[Push] Registration error:', err);
    });

    // 5. Handle notifications received while app is in foreground
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Foreground notification:', notification);
      // Optionally show a custom in-app toast here
    });

    // 6. Handle notification tap (app opened from notification)
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[Push] Notification action:', action);
      const data = action.notification.data;
      // Route user based on data payload if needed
      if (data?.path && typeof window !== 'undefined') {
        window.location.href = data.path;
      }
    });
  } catch (err) {
    console.error('[Push] initPushNotifications error:', err);
  }
}
