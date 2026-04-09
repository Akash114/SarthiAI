import type { TokenPairResponse } from "../api/auth";
import { getJwtExpiryMs } from "./jwtPayload";
import * as sessionStore from "./sessionStore";

const ACCESS_KEY = "sarthiai:access_token";
const REFRESH_KEY = "sarthiai:refresh_token";

let memoryAccess: string | null = null;
let memoryRefresh: string | null = null;
let accessExpiresAtMs: number | null = null;

export function getAccessTokenSync(): string | null {
  return memoryAccess;
}

export function getRefreshTokenSync(): string | null {
  return memoryRefresh;
}

export function hasRefreshToken(): boolean {
  return memoryRefresh !== null && memoryRefresh.length > 0;
}

export function isAccessExpired(bufferMs = 60_000): boolean {
  if (!memoryAccess) {
    return true;
  }
  if (accessExpiresAtMs === null) {
    return false;
  }
  return Date.now() >= accessExpiresAtMs - bufferMs;
}

export async function hydrateFromStorage(): Promise<void> {
  const [access, refresh] = await Promise.all([
    sessionStore.getSecureItem(ACCESS_KEY),
    sessionStore.getSecureItem(REFRESH_KEY),
  ]);
  memoryAccess = access;
  memoryRefresh = refresh;
  accessExpiresAtMs = memoryAccess ? getJwtExpiryMs(memoryAccess) : null;
}

export async function setTokensFromPair(pair: TokenPairResponse): Promise<void> {
  memoryAccess = pair.access_token;
  memoryRefresh = pair.refresh_token;
  const fromJwt = getJwtExpiryMs(pair.access_token);
  accessExpiresAtMs = fromJwt ?? Date.now() + pair.expires_in * 1000;
  await Promise.all([
    sessionStore.setSecureItem(ACCESS_KEY, pair.access_token),
    sessionStore.setSecureItem(REFRESH_KEY, pair.refresh_token),
  ]);
}

export async function clearTokens(): Promise<void> {
  memoryAccess = null;
  memoryRefresh = null;
  accessExpiresAtMs = null;
  await Promise.all([sessionStore.deleteSecureItem(ACCESS_KEY), sessionStore.deleteSecureItem(REFRESH_KEY)]);
}
