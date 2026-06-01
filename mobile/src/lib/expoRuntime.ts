import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * True when running inside the generic Expo Go app (not a dev client or store build).
 * On Android, Expo Go cannot use expo-notifications remote push since SDK 53.
 */
export function isExpoGo(): boolean {
  return Constants.expoGoConfig != null;
}

export function isExpoGoAndroid(): boolean {
  return Platform.OS === 'android' && isExpoGo();
}

/** Remote push + expo-notifications native module are unavailable in Expo Go on Android. */
export function supportsExpoNotifications(): boolean {
  return !isExpoGoAndroid();
}
