import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { useTheme } from "../theme";
import { useMutationQueue } from "./MutationQueueContext";

/**
 * Thin status strip: offline, syncing, pending count, failed hint.
 * Tap triggers a flush when there is work pending and we're online.
 */
export function OfflineSyncBanner() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { isOnline } = useNetworkStatus();
  const { pendingCount, failed, isFlushing, flush } = useMutationQueue();

  const message = useMemo(() => {
    if (!isOnline) {
      return "You're offline";
    }
    if (isFlushing) {
      return "Syncing changes…";
    }
    if (failed.length > 0) {
      return "Some changes couldn't sync — open My Week to retry";
    }
    if (pendingCount > 0) {
      return `${pendingCount} change${pendingCount === 1 ? "" : "s"} waiting to sync`;
    }
    return null;
  }, [isOnline, isFlushing, failed.length, pendingCount]);

  if (message === null && !isFlushing) {
    return null;
  }

  const showTapHint = Boolean(message) && isOnline && !isFlushing && pendingCount > 0;

  return (
    <Pressable
      onPress={() => {
        if (showTapHint) {
          void flush();
        }
      }}
      style={[
        styles.bar,
        {
          paddingTop: Math.max(insets.top, 8),
          backgroundColor: theme.mode === "dark" ? theme.surfaceMuted : "#fef3c7",
          borderBottomColor: theme.border,
        },
      ]}
    >
      <Text style={[styles.text, { color: theme.textPrimary }]}>{message ?? " "}</Text>
      {showTapHint ? (
        <Text style={[styles.hint, { color: theme.textSecondary }]}>Tap to sync now</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: "600",
  },
  hint: {
    fontSize: 12,
    marginTop: 2,
  },
});
