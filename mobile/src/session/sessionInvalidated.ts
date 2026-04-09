let onInvalidate: (() => void) | null = null;

export function setSessionInvalidateHandler(fn: (() => void) | null): void {
  onInvalidate = fn;
}

export function notifySessionInvalidated(): void {
  onInvalidate?.();
}
