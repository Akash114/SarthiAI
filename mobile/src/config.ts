import Constants from 'expo-constants';
import { Platform } from 'react-native';

const extra = Constants.expoConfig?.extra ?? {};

/**
 * Default API origin by platform.
 * - Android emulator: 10.0.2.2 is the host machine (not for physical devices).
 * - iOS simulator / most dev: loopback works.
 * Physical device: set EXPO_PUBLIC_API_URL to http://<your-lan-ip>:8000 (or adb reverse + http://127.0.0.1:8000).
 */
function defaultApiUrl(): string {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }
  return 'http://127.0.0.1:8000';
}

const envUrl =
  typeof process.env.EXPO_PUBLIC_API_URL === 'string' && process.env.EXPO_PUBLIC_API_URL.trim() !== ''
    ? process.env.EXPO_PUBLIC_API_URL.trim()
    : null;

const extraUrl =
  typeof extra.apiUrl === 'string' && extra.apiUrl.trim() !== '' ? extra.apiUrl.trim() : null;

export const API_BASE_URL = String(envUrl ?? extraUrl ?? defaultApiUrl()).replace(/\/$/, '');

export const POSTHOG_KEY = String(extra.posthogKey ?? '');
export const POSTHOG_HOST = String(extra.posthogHost ?? 'https://us.i.posthog.com');
export const SENTRY_DSN = String(extra.sentryDsn ?? '');
