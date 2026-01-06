import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

import { getWeeklyPlanHistoryItem, WeeklyPlanResponse } from "../api/weeklyPlan";
import { useUserId } from "../state/user";
import type { RootStackParamList } from "../../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "WeeklyPlanHistoryDetail">;

export default function WeeklyPlanHistoryDetailScreen({ route }: Props) {
  const { logId } = route.params;
  const { userId, loading: userLoading } = useUserId();
  const [snapshot, setSnapshot] = useState<WeeklyPlanResponse | null>(null);
  const [meta, setMeta] = useState<{ created_at: string; week_start: string; week_end: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { detail, meta } = await getWeeklyPlanHistoryItem(userId, logId);
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
      <Text style={styles.helper}>Generated {new Date(meta.created_at).toLocaleString()}</Text>

      <View style={styles.card}>
        <Text style={styles.section}>Focus</Text>
        <Text style={styles.planTitle}>{snapshot.micro_resolution.title}</Text>
        <Text style={styles.body}>{snapshot.micro_resolution.why_this}</Text>

        <Text style={[styles.section, styles.mt16]}>Suggested Tasks</Text>
        {snapshot.micro_resolution.suggested_week_1_tasks.map((task) => (
          <View key={task.title} style={styles.taskRow}>
            <Text style={styles.taskTitle}>{task.title}</Text>
            <Text style={styles.taskMeta}>
              {task.duration_min ? `${task.duration_min} min` : "Flexible"}
              {task.suggested_time ? ` · ${task.suggested_time}` : ""}
            </Text>
          </View>
        ))}
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
    color: "#333",
  },
  planTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 4,
  },
  body: {
    marginTop: 4,
    color: "#444",
  },
  mt16: {
    marginTop: 16,
  },
  taskRow: {
    marginTop: 8,
  },
  taskTitle: {
    fontWeight: "500",
  },
  taskMeta: {
    color: "#666",
  },
  error: {
    color: "#c62828",
  },
});
