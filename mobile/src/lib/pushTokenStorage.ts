import * as SecureStore from 'expo-secure-store';

const KEY = 'sarthi_last_expo_push_token';

export async function setLastRegisteredPushToken(token: string | null): Promise<void> {
  if (token) {
    await SecureStore.setItemAsync(KEY, token);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    /* missing key */
  }
}

export async function getLastRegisteredPushToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}
