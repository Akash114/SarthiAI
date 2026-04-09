import AsyncStorage from "@react-native-async-storage/async-storage";
import { generateUUID, isValidUUID } from "../utils/uuid";

export const ANONYMOUS_USER_STORAGE_KEY = "sarthiai:user_id";

/** Ensure a valid anonymous device UUID exists in AsyncStorage; returns it. */
export async function ensureAnonymousUserId(): Promise<string> {
  let stored = await AsyncStorage.getItem(ANONYMOUS_USER_STORAGE_KEY);
  if (!stored || !isValidUUID(stored)) {
    stored = generateUUID();
    await AsyncStorage.setItem(ANONYMOUS_USER_STORAGE_KEY, stored);
  }
  return stored;
}
