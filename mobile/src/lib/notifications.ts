import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { apiJson } from '../api/client';
import { capturePushTokenRegistered } from './analytics';
import { getClientDeviceId } from './deviceId';
import { supportsExpoNotifications } from './expoRuntime';
import { getLastRegisteredPushToken, setLastRegisteredPushToken } from './pushTokenStorage';
import { useSessionStore } from '../state/sessionStore';

function configureNotifications(): boolean {
  if (!supportsExpoNotifications()) return false;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  return true;
}

const notificationsReady = configureNotifications();

export function pushPlatform(): 'android' | 'ios' {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!notificationsReady) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

function getExpoProjectId(): string | undefined {
  const fromEas = Constants.easConfig?.projectId;
  if (typeof fromEas === 'string' && fromEas.length > 0) return fromEas;
  const fromExtra = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
    ?.projectId;
  if (typeof fromExtra === 'string' && fromExtra.length > 0) return fromExtra;
  return undefined;
}

/** Local heads-up when an intervention is pending (slice demo). */
export async function notifyInterventionPending(): Promise<void> {
  if (!notificationsReady) return;
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

export async function enablePushAndRegister(): Promise<{ granted: boolean; registered: boolean }> {
  if (!notificationsReady) {
    return { granted: false, registered: false };
  }
  const granted = await ensureNotificationPermission();
  if (!granted) return { granted: false, registered: false };
  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId: getExpoProjectId() });
    if (!token.data) return { granted: true, registered: false };
    await registerPushTokenWithBackend(token.data);
    return { granted: true, registered: true };
  } catch {
    return { granted: true, registered: false };
  }
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
