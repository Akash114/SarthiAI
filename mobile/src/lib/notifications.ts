import * as Notifications from 'expo-notifications';

import { API_BASE_URL } from '../config';
import { capturePushTokenRegistered } from './analytics';
import { useSessionStore } from '../state/sessionStore';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** Local heads-up when an intervention is pending (slice demo). */
export async function notifyInterventionPending(): Promise<void> {
  const granted = await ensureNotificationPermission();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Sarthi',
      body: 'You have a check-in waiting in the app.',
    },
    trigger: null,
  });
}

export async function registerPushTokenWithBackend(expoToken: string): Promise<void> {
  const token = useSessionStore.getState().accessToken;
  if (!token) return;
  const res = await fetch(`${API_BASE_URL}/v1/devices/push-token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `push-${Date.now()}`,
    },
    body: JSON.stringify({ expo_push_token: expoToken, platform: 'android' }),
  });
  if (res.ok) {
    capturePushTokenRegistered('android');
  }
}
