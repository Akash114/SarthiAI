import { useEffect } from "react";
import { AppState } from "react-native";
import { updatePreferences } from "../api/preferences";
import { useNotifications } from "../hooks/useNotifications";
import { useSession } from "./SessionContext";

/**
 * On session ready: register Expo push token (when token changes), sync device IANA timezone to the server.
 * On foreground: re-attempt push registration after token rotation or permission changes.
 */
export function SessionBootstrapEffects() {
  const { status, effectiveUserId } = useSession();
  const { registerForPushNotificationsAsync } = useNotifications();

  useEffect(() => {
    if (status !== "ready" || !effectiveUserId) {
      return;
    }
    void (async () => {
      await registerForPushNotificationsAsync(effectiveUserId);
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        await updatePreferences(effectiveUserId, { timezone: tz });
      } catch {
        // best-effort
      }
    })();
  }, [status, effectiveUserId, registerForPushNotificationsAsync]);

  useEffect(() => {
    if (status !== "ready" || !effectiveUserId) {
      return;
    }
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void registerForPushNotificationsAsync(effectiveUserId);
      }
    });
    return () => sub.remove();
  }, [status, effectiveUserId, registerForPushNotificationsAsync]);

  return null;
}
