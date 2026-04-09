import { API_BASE_URL } from "./config";

export type TokenPairResponse = {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in: number;
  user_id: string;
  request_id?: string;
};

export type AuthMeResponse = {
  user_id: string;
  email: string | null;
  request_id?: string;
};

export type MergeAnonymousResponse = {
  merged: boolean;
  authenticated_user_id: string;
  message?: string;
  request_id?: string;
};

async function authFetch<T>(path: string, init: RequestInit): Promise<T> {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${API_BASE_URL}${normalized}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = json?.detail ?? response.statusText ?? "Request failed";
    throw new Error(typeof message === "string" ? message : "Request failed");
  }
  return json as T;
}

export async function registerWithPassword(email: string, password: string): Promise<TokenPairResponse> {
  return authFetch<TokenPairResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function loginWithPassword(email: string, password: string): Promise<TokenPairResponse> {
  return authFetch<TokenPairResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function refreshTokens(refreshToken: string): Promise<TokenPairResponse> {
  return authFetch<TokenPairResponse>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export async function logoutWithAccessToken(accessToken: string): Promise<void> {
  await authFetch<unknown>("/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({}),
  });
}

export async function fetchAuthMe(accessToken: string): Promise<AuthMeResponse> {
  return authFetch<AuthMeResponse>("/auth/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function mergeAnonymous(accessToken: string, anonymousUserId: string): Promise<MergeAnonymousResponse> {
  return authFetch<MergeAnonymousResponse>("/auth/merge-anonymous", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ anonymous_user_id: anonymousUserId }),
  });
}
