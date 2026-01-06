import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { listWeeklyPlanHistory, WeeklyPlanHistoryItem } from "../api/weeklyPlan";
import { useUserId } from "../state/user";
import type { RootStackParamList } from "../../types/navigation";

type Nav = NativeStackNavigationProp<RootStackParamList, "WeeklyPlanHistory">;

export default function WeeklyPlanHistoryScreen() {
  const { userId, loading: userLoading } = useUserId();
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<WeeklyPlanHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { items: list } = await listWeeklyPlanHistory(userId);
      setItems(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userLoading && userId) {
      fetchHistory();
    }
  }, [fetchHistory, userId, userLoading]);

  if (userLoading || (loading && !refreshing)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.helper}>Loading history…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchHistory(); }} />}
    >
      <Text style={styles.title}>Weekly History</Text>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchHistory}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.card}
          onPress={() => navigation.navigate("WeeklyPlanHistoryDetail", { logId: item.id })}
        >
          <Text style={styles.cardWeek}>{item.week_start} → {item.week_end}</Text>
          <Text style={styles.cardTitle}>{item.title || "Weekly snapshot"}</Text>
          <Text style={styles.cardMeta}>
            Created {new Date(item.created_at).toLocaleString()} · Completion {item.completion_rate != null ? `${(item.completion_rate * 100).toFixed(0)}%` : "—"}
          </Text>
        </TouchableOpacity>
      ))}
      {!items.length && !error ? <Text style={styles.helper}>No snapshots yet.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
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
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e7f0",
    padding: 12,
    backgroundColor: "#fff",
  },
  cardWeek: {
    color: "#1a73e8",
    fontWeight: "600",
  },
  cardTitle: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: "600",
  },
  cardMeta: {
    marginTop: 4,
    color: "#666",
  },
  helper: {
    marginTop: 12,
    color: "#666",
  },
  errorBox: {
    backgroundColor: "#fdecea",
    borderRadius: 12,
    padding: 12,
  },
  error: {
    color: "#c62828",
  },
  retryButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#c62828",
    borderRadius: 8,
  },
  retryText: {
    color: "#c62828",
    fontWeight: "600",
  },
});
