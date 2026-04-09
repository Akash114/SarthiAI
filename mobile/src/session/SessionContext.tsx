import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import {
  fetchAuthMe,
  loginWithPassword,
  logoutWithAccessToken,
  mergeAnonymous,
  refreshTokens,
  registerWithPassword,
  type TokenPairResponse,
} from "../api/auth";
import { unregisterPushToken } from "../api/notifications";
import { LAST_EXPO_PUSH_TOKEN_KEY } from "../pushTokenStorage";
import { ANONYMOUS_USER_STORAGE_KEY, ensureAnonymousUserId } from "./anonymousUserId";
import { setSessionInvalidateHandler } from "./sessionInvalidated";
import {
  clearTokens,
  getAccessTokenSync,
  getRefreshTokenSync,
  hasRefreshToken,
  hydrateFromStorage,
  setTokensFromPair,
} from "./sessionTokens";

type SessionStatus = "bootstrapping" | "ready";

export type SessionContextValue = {
  status: SessionStatus;
  isAuthenticated: boolean;
  authUserId: string | null;
  email: string | null;
  anonymousUserId: string | null;
  effectiveUserId: string | null;
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearSessionExpired: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function resolveProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    process.env.EXPO_PROJECT_ID
  );
}

async function tryUnregisterPushForUser(userId: string): Promise<void> {
  try {
    const projectId = resolveProjectId();
    const options = projectId ? { projectId } : undefined;
    const expoPushToken = await Notifications.getExpoPushTokenAsync(options);
    if (expoPushToken?.data) {
      await unregisterPushToken(userId, expoPushToken.data);
    }
  } catch {
    // best-effort
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("bootstrapping");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [anonymousUserId, setAnonymousUserId] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    setSessionInvalidateHandler(() => {
      setSessionExpired(true);
      setIsAuthenticated(false);
      setAuthUserId(null);
      setEmail(null);
    });
    return () => setSessionInvalidateHandler(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await hydrateFromStorage();
      const anon = await ensureAnonymousUserId();
      if (cancelled) {
        return;
      }
      setAnonymousUserId(anon);

      if (hasRefreshToken()) {
        try {
          const pair = await refreshTokens(getRefreshTokenSync()!);
          await setTokensFromPair(pair);
          setAuthUserId(pair.user_id);
          setIsAuthenticated(true);
          try {
            const me = await fetchAuthMe(pair.access_token);
            if (!cancelled) {
              setEmail(me.email ?? null);
            }
          } catch {
            if (!cancelled) {
              setEmail(null);
            }
          }
        } catch {
          await clearTokens();
          if (!cancelled) {
            setAuthUserId(null);
            setIsAuthenticated(false);
            setEmail(null);
          }
        }
      } else if (getAccessTokenSync()) {
        await clearTokens();
      }

      if (!cancelled) {
        setStatus("ready");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const completeAuthFromPair = useCallback(async (pair: TokenPairResponse) => {
    const prevAnon = await AsyncStorage.getItem(ANONYMOUS_USER_STORAGE_KEY);
    await setTokensFromPair(pair);
    setAuthUserId(pair.user_id);
    setIsAuthenticated(true);

    if (prevAnon && prevAnon !== pair.user_id) {
      try {
        await mergeAnonymous(pair.access_token, prevAnon);
      } catch {
        // merge is best-effort; user can retry by signing in again if needed
      }
    }

    await AsyncStorage.setItem(ANONYMOUS_USER_STORAGE_KEY, pair.user_id);
    setAnonymousUserId(pair.user_id);

    try {
      const me = await fetchAuthMe(pair.access_token);
      setEmail(me.email ?? null);
    } catch {
      setEmail(null);
    }
    setSessionExpired(false);
  }, []);

  const login = useCallback(
    async (userEmail: string, password: string) => {
      const pair = await loginWithPassword(userEmail, password);
      await completeAuthFromPair(pair);
    },
    [completeAuthFromPair],
  );

  const register = useCallback(
    async (userEmail: string, password: string) => {
      const pair = await registerWithPassword(userEmail, password);
      await completeAuthFromPair(pair);
    },
    [completeAuthFromPair],
  );

  const logout = useCallback(async () => {
    const access = getAccessTokenSync();
    const uidForPush = authUserId ?? anonymousUserId;
    if (access && uidForPush) {
      await tryUnregisterPushForUser(uidForPush);
    }
    if (access) {
      try {
        await logoutWithAccessToken(access);
      } catch {
        // still clear locally
      }
    }
    await clearTokens();
    await AsyncStorage.removeItem(LAST_EXPO_PUSH_TOKEN_KEY);
    setAuthUserId(null);
    setIsAuthenticated(false);
    setEmail(null);
    setSessionExpired(false);
  }, [authUserId, anonymousUserId]);

  const clearSessionExpired = useCallback(() => {
    setSessionExpired(false);
  }, []);

  const effectiveUserId = isAuthenticated && authUserId ? authUserId : anonymousUserId;

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      isAuthenticated,
      authUserId,
      email,
      anonymousUserId,
      effectiveUserId,
      sessionExpired,
      login,
      register,
      logout,
      clearSessionExpired,
    }),
    [
      status,
      isAuthenticated,
      authUserId,
      email,
      anonymousUserId,
      effectiveUserId,
      sessionExpired,
      login,
      register,
      logout,
      clearSessionExpired,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return ctx;
}
