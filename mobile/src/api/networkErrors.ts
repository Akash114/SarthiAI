/** Thrown by apiRequest for HTTP and classified network failures (see client.ts). */
export class ApiError extends Error {
  readonly name = "ApiError";

  constructor(
    message: string,
    readonly status: number,
    readonly isNetworkError = false,
  ) {
    super(message);
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Recoverable: no response or transport failure; retry when online. */
export function isLikelyNetworkFailure(error: unknown): boolean {
  if (isApiError(error) && error.isNetworkError) {
    return true;
  }
  if (error instanceof TypeError) {
    return true;
  }
  if (error instanceof Error) {
    const m = error.message;
    if (m.includes("Network request failed")) {
      return true;
    }
    if (m.includes("Failed to fetch") || m.includes("NetworkError")) {
      return true;
    }
  }
  if (isApiError(error)) {
    const s = error.status;
    return s === 502 || s === 503 || s === 504;
  }
  return false;
}

/** Session invalid after refresh failure or explicit 401. Queue flush should stop. */
export function isAuthFailure(error: unknown): boolean {
  return isApiError(error) && error.status === 401;
}
