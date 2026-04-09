import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const WEB_PREFIX = "sarthiai_secure_";

export async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    if (typeof sessionStorage === "undefined") {
      return null;
    }
    return sessionStorage.getItem(WEB_PREFIX + key);
  }
  return SecureStore.getItemAsync(key);
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(WEB_PREFIX + key, value);
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(WEB_PREFIX + key);
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
