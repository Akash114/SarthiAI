import { API_BASE_URL } from '../config';
import { useSessionStore } from '../state/sessionStore';

export type AuthTokenResponse = {
  access_token: string;
  refresh_token: string;
  access_expires_at: string;
  refresh_expires_at: string;
};

const FETCH_TIMEOUT_MS = 20_000;

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Request timed out — check API URL and that the server is reachable.');
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

async function refreshAccess(): Promise<boolean> {
  const refresh = await useSessionStore.getState().readRefreshToken();
  if (!refresh) return false;
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return false;
    const j = (await res.json()) as AuthTokenResponse;
    useSessionStore.getState().setAccessToken(j.access_token);
    await useSessionStore.getState().saveRefreshToken(j.refresh_token);
    return true;
  } catch {
    return false;
  }
}

export async function apiJson<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
  _retried = false,
): Promise<T> {
  const token = useSessionStore.getState().accessToken;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | null | undefined = init.body ?? null;
  if (init.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.json);
  }
  const res = await fetchWithTimeout(`${API_BASE_URL}${path}`, { ...init, headers, body });
  if (res.status === 401 && path !== '/v1/auth/refresh' && !_retried) {
    const ok = await refreshAccess();
    if (ok) return apiJson<T>(path, init, true);
  }
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}
