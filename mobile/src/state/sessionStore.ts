import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { restoreSessionFromRefresh } from '../api/client';
import type { UserProfile } from '../api/types';
import { captureOnboardingCompleted } from '../lib/analytics';

const REFRESH_KEY = 'sarthi_refresh_token';
const ONBOARDING_COMPLETE_KEY = 'sarthi_onboarding_complete';

type SessionState = {
  accessToken: string | null;
  user: UserProfile | null;
  onboardingComplete: boolean | null;
  sessionReady: boolean;
  setAccessToken: (t: string | null) => void;
  setUser: (user: UserProfile | null) => void;
  bootstrapSession: () => Promise<void>;
  hydrateOnboarding: () => Promise<void>;
  setOnboardingComplete: () => Promise<void>;
  saveRefreshToken: (t: string) => Promise<void>;
  readRefreshToken: () => Promise<string | null>;
  clearSession: () => Promise<void>;
};

export const useSessionStore = create<SessionState>((set, get) => ({
  accessToken: null,
  user: null,
  onboardingComplete: null,
  sessionReady: false,
  setAccessToken: (t) => set({ accessToken: t }),
  setUser: (user) => set({ user }),
  hydrateOnboarding: async () => {
    const value = await SecureStore.getItemAsync(ONBOARDING_COMPLETE_KEY);
    set({ onboardingComplete: value === '1' });
  },
  bootstrapSession: async () => {
    await get().hydrateOnboarding();
    const restored = await restoreSessionFromRefresh();
    if (!restored) {
      const staleRefresh = await get().readRefreshToken();
      if (staleRefresh) {
        try {
          await SecureStore.deleteItemAsync(REFRESH_KEY);
        } catch {
          /* missing key */
        }
      }
    }
    set({ sessionReady: true });
  },
  setOnboardingComplete: async () => {
    await SecureStore.setItemAsync(ONBOARDING_COMPLETE_KEY, '1');
    captureOnboardingCompleted();
    set({ onboardingComplete: true });
  },
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
    set({ accessToken: null, user: null });
  },
}));
