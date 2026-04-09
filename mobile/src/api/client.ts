import { API_BASE_URL } from "./config";
import { refreshTokens } from "./auth";
import { notifySessionInvalidated } from "../session/sessionInvalidated";
import {
  clearTokens,
  getAccessTokenSync,
  getRefreshTokenSync,
  hasRefreshToken,
  setTokensFromPair,
} from "../session/sessionTokens";

type ApiOptions = Omit<RequestInit, "body"> & {
  body?: Record<string, unknown>;
  /** Skip Authorization and 401→refresh (for auth endpoints or bootstrap). */
  skipAuthRefresh?: boolean;
};

let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessTokenSingleFlight(): Promise<boolean> {
  const refresh = getRefreshTokenSync();
  if (!refresh) {
    return false;
  }
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const pair = await refreshTokens(refresh);
        await setTokensFromPair(pair);
        return true;
      } catch {
        await clearTokens();
        notifySessionInvalidated();
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

export async function apiRequest<TResponse>(
  path: string,
  options: ApiOptions = {},
): Promise<{
  data: TResponse;
  response: Response;
}> {
  const { skipAuthRefresh = false, ...rest } = options;
  return performRequest<TResponse>(path, { ...rest, skipAuthRefresh }, false);
}

async function performRequest<TResponse>(
  path: string,
  options: ApiOptions,
  isRetry: boolean,
): Promise<{
  data: TResponse;
  response: Response;
}> {
  const { skipAuthRefresh = false, body, ...init } = options;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };

  if (!skipAuthRefresh) {
    const token = getAccessTokenSync();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  try {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const response = await fetch(`${API_BASE_URL}${normalizedPath}`, {
      ...init,
      method: init.method ?? "GET",
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    const json = text ? JSON.parse(text) : null;

    if (
      response.status === 401 &&
      !skipAuthRefresh &&
      !isRetry &&
      hasRefreshToken()
    ) {
      const ok = await refreshAccessTokenSingleFlight();
      if (ok) {
        return performRequest<TResponse>(path, options, true);
      }
      const message = json?.detail ?? "Session expired. Please sign in again.";
      throw new Error(typeof message === "string" ? message : "Session expired");
    }

    if (!response.ok) {
      const message = json?.detail ?? response.statusText ?? "Request failed";
      throw new Error(typeof message === "string" ? message : "Request failed");
    }

    return { data: json as TResponse, response };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new Error(
        `Network request failed. Make sure the backend server is running at ${API_BASE_URL}`,
      );
    }
    throw error;
  }
}

export { API_BASE_URL };
