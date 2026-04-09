import { useNetworkState } from "expo-network";
import type { NetworkState } from "expo-network";

/**
 * Derived online flag for UX (banners, proactive offline submit).
 * When `isInternetReachable` is false, treat as offline. When it is null/undefined (common on
 * simulators / first tick), fall back to `isConnected`. iOS often mirrors connected === internet.
 *
 * Manual QA: `expo-network` can report stale state on iOS Simulator when toggling Wi‑Fi; validate
 * airplane-mode flows on a physical device before release.
 */
export function useNetworkStatus(): {
  isOnline: boolean;
  networkState: NetworkState;
} {
  const networkState = useNetworkState();
  const { isConnected, isInternetReachable } = networkState;

  if (isConnected === false) {
    return { isOnline: false, networkState };
  }

  if (isInternetReachable === false) {
    return { isOnline: false, networkState };
  }

  // Connected or unknown: avoid showing offline until we know there's no link
  if (isConnected === true) {
    return { isOnline: true, networkState };
  }

  // Bootstrapping / unknown: assume online so we do not block actions spuriously
  return { isOnline: true, networkState };
}
