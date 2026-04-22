import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { apiJson } from '../api/client';
import { capturePushTokenRegistered } from './analytics';
import { getClientDeviceId } from './deviceId';
import { getLastRegisteredPushToken, setLastRegisteredPushToken } from './pushTokenStorage';
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

export function pushPlatform(): 'android' | 'ios' {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

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
  const platform = pushPlatform();
  await apiJson('/v1/devices/push-token', {
    method: 'POST',
    json: {
      expo_push_token: expoToken,
      platform,
      device_id: getClientDeviceId(),
    },
    headers: { 'Idempotency-Key': `push-${Date.now()}` },
  });
  await setLastRegisteredPushToken(expoToken);
  capturePushTokenRegistered(platform);
}

/** Best-effort: remove push row server-side (e.g. logout). */
export async function unregisterPushTokenFromBackend(): Promise<void> {
  const expoToken = await getLastRegisteredPushToken();
  const accessToken = useSessionStore.getState().accessToken;
  if (!expoToken || !accessToken) return;
  try {
    await apiJson('/v1/devices/push-token', {
      method: 'DELETE',
      json: {
        expo_push_token: expoToken,
        platform: pushPlatform(),
        device_id: getClientDeviceId(),
      },
    });
  } catch {
    /* ignore */
  }
  await setLastRegisteredPushToken(null);
}
