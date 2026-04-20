import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const REFRESH_KEY = 'sarthi_refresh_token';

type SessionState = {
  accessToken: string | null;
  setAccessToken: (t: string | null) => void;
  saveRefreshToken: (t: string) => Promise<void>;
  readRefreshToken: () => Promise<string | null>;
  clearSession: () => Promise<void>;
};

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  setAccessToken: (t) => set({ accessToken: t }),
  saveRefreshToken: async (t) => {
    await SecureStore.setItemAsync(REFRESH_KEY, t);
  },
  readRefreshToken: async () => SecureStore.getItemAsync(REFRESH_KEY),
  clearSession: async () => {
    try {
      await SecureStore.deleteItemAsync(REFRESH_KEY);
    } catch {
      /* missing key */
    }
    set({ accessToken: null });
  },
}));
