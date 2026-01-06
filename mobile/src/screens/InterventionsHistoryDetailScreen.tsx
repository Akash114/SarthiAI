import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { getInterventionHistoryItem, InterventionResponse } from "../api/interventions";
import { useUserId } from "../state/user";
import type { RootStackParamList } from "../../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "InterventionsHistoryDetail">;

export default function InterventionsHistoryDetailScreen({ route }: Props) {
  const { logId } = route.params;
  const { userId, loading: userLoading } = useUserId();
  const [snapshot, setSnapshot] = useState<InterventionResponse | null>(null);
  const [meta, setMeta] = useState<{ created_at: string; week_start: string; week_end: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { detail, meta } = await getInterventionHistoryItem(userId, logId);
      setSnapshot(detail);
      setMeta(meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load snapshot.");
    } finally {
      setLoading(false);
    }
  }, [logId, userId]);

  useEffect(() => {
    if (!userLoading && userId) {
      loadDetail();
    }
  }, [loadDetail, userId, userLoading]);

  if (userLoading || loading || !snapshot || !meta) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator />}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Week {meta.week_start} – {meta.week_end}</Text>
      <Text style={styles.helper}>Created {new Date(meta.created_at).toLocaleString()}</Text>

      <View style={styles.card}>
        <Text style={styles.section}>Slippage</Text>
        <Text style={styles.body}>Flagged: {snapshot.slippage.flagged ? "Yes" : "No"}</Text>
        <Text style={styles.body}>Reason: {snapshot.slippage.reason || "—"}</Text>
        <Text style={styles.body}>Completion: {(snapshot.slippage.completion_rate * 100).toFixed(0)}%</Text>
        <Text style={styles.body}>Missed scheduled: {snapshot.slippage.missed_scheduled}</Text>

        {snapshot.card ? (
          <View style={styles.mt16}>
            <Text style={styles.section}>{snapshot.card.title}</Text>
            <Text style={styles.body}>{snapshot.card.message}</Text>
            {snapshot.card.options.map((option) => (
              <View key={option.key} style={styles.optionRow}>
                <Text style={styles.optionLabel}>{option.label}</Text>
                <Text style={styles.optionDetails}>{option.details}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.optionLabel}>Looks on track</Text>
            <Text style={styles.optionDetails}>No intervention needed.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 12,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
  },
  helper: {
    color: "#666",
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e7f0",
    padding: 16,
    backgroundColor: "#fff",
  },
  section: {
    fontWeight: "600",
  },
  body: {
    marginTop: 4,
    color: "#444",
  },
  mt16: {
    marginTop: 16,
  },
  optionRow: {
    marginTop: 8,
  },
  optionLabel: {
    fontWeight: "600",
  },
  optionDetails: {
    color: "#555",
  },
  emptyCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#f5f7fb",
  },
  error: {
    color: "#c62828",
  },
});
