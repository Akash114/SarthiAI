/** Read JWT `exp` (seconds since epoch) without external deps; payload must be JSON. */
export function getJwtExpiryMs(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[1]) {
      return null;
    }
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
    if (typeof globalThis.atob !== "function") {
      return null;
    }
    const decoded = globalThis.atob(base64 + pad);
    const payload = JSON.parse(decoded) as { exp?: number };
    if (typeof payload.exp !== "number") {
      return null;
    }
    return payload.exp * 1000;
  } catch {
    return null;
  }
}
