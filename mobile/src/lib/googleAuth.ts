import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';

WebBrowser.maybeCompleteAuthSession();

const extra = Constants.expoConfig?.extra ?? {};

const webClientId =
  (typeof process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID === 'string' &&
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.trim()) ||
  (typeof extra.googleWebClientId === 'string' && extra.googleWebClientId.trim()) ||
  undefined;

const iosClientId =
  (typeof process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID === 'string' &&
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID.trim()) ||
  (typeof extra.googleIosClientId === 'string' && extra.googleIosClientId.trim()) ||
  undefined;

const androidClientId =
  (typeof process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID === 'string' &&
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID.trim()) ||
  (typeof extra.googleAndroidClientId === 'string' && extra.googleAndroidClientId.trim()) ||
  undefined;

export function useGoogleIdTokenAuth() {
  return Google.useIdTokenAuthRequest({
    webClientId,
    iosClientId,
    androidClientId,
  });
}

export function isGoogleAuthConfigured(): boolean {
  return Boolean(webClientId || iosClientId || androidClientId);
}
