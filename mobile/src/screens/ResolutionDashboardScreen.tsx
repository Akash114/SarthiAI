import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { fetchDashboard, DashboardResolution } from "../api/dashboard";
import { useUserId } from "../state/user";
import type { RootStackParamList } from "../../types/navigation";

type DashboardNavProp = NativeStackNavigationProp<RootStackParamList, "Dashboard">;

export default function ResolutionDashboardScreen() {
  const navigation = useNavigation<DashboardNavProp>();
  const { userId, loading: userLoading } = useUserId();
  const [dashboard, setDashboard] = useState<DashboardResolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { dashboard: data, requestId: reqId } = await fetchDashboard(userId);
      setDashboard(data.active_resolutions);
      setRequestId(reqId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!userLoading && userId) {
      loadDashboard();
    }
  }, [userLoading, userId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  const sortedResolutions = useMemo(() => {
    return [...dashboard].sort((a, b) => {
      const aDone = a.completion_rate >= 1;
      const bDone = b.completion_rate >= 1;
      const aNeeds = a.completion_rate < 0.6;
      const bNeeds = b.completion_rate < 0.6;
      if (aNeeds !== bNeeds) return aNeeds ? -1 : 1;
      if (aDone !== bDone) return aDone ? 1 : -1;
      return a.title.localeCompare(b.title);
    });
  }, [dashboard]);

  const summary = useMemo(() => {
    const totals = dashboard.reduce(
      (acc, res) => {
        acc.scheduled += res.tasks.total;
        acc.completed += res.tasks.completed;
        return acc;
      },
      { scheduled: 0, completed: 0 },
    );
    const rate = totals.scheduled ? totals.completed / totals.scheduled : 0;
    return { ...totals, rate };
  }, [dashboard]);

  if (userLoading || (loading && !dashboard.length)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6B8DBF" />
        <Text style={styles.helper}>Gathering insights…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.retry} onPress={loadDashboard}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!dashboard.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No active resolutions</Text>
        <Text style={styles.helper}>No active resolutions. Start a new journey from Home.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Weekly Overview</Text>
        <Text style={styles.summaryStat}>
          {summary.completed}/{summary.scheduled} Tasks
        </Text>
        <View style={styles.summaryBar}>
          <View
            style={[
              styles.summaryFill,
              {
                width: `${Math.min(100, Math.round(summary.rate * 100))}%`,
                backgroundColor: summary.rate >= 0.6 ? "#48BB78" : "#ECC94B",
              },
            ]}
          />
        </View>
      </View>
      <Text style={styles.headerTitle}>Focus Areas</Text>
      {sortedResolutions.map((resolution) => {
        const completionPercent = Math.round(resolution.completion_rate * 100);
        const badge = getStatusBadge(completionPercent);
        const latestActivity = resolution.recent_activity[0];
        const duration = resolution.duration_weeks ?? "—";
        const currentWeek =
          typeof duration === "number"
            ? Math.min(duration, Math.max(1, Math.round(resolution.completion_rate * duration) || 1))
            : "—";
        return (
          <TouchableOpacity
            key={resolution.resolution_id}
            style={[
              styles.card,
              resolution.completion_rate >= 1 && styles.cardComplete,
              resolution.completion_rate < 0.6 && styles.cardWarning,
            ]}
            onPress={() => navigation.navigate("ResolutionDashboardDetail", { resolutionId: resolution.resolution_id })}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleWrapper}>
                <Text style={styles.title}>{resolution.title}</Text>
              </View>
              <View style={[styles.badge, badge.style]}>
                <Text style={[styles.badgeText, badge.textStyle]}>{badge.label}</Text>
              </View>
            </View>
            <View style={styles.progressRow}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${completionPercent}%` }]} />
              </View>
            </View>
            <View style={styles.statsRow}>
              <Text style={styles.meta}>
                {resolution.tasks.completed}/{resolution.tasks.total} Tasks
              </Text>
              <Text style={styles.meta}>
                Week {currentWeek} of {duration}
              </Text>
            </View>
            {latestActivity ? (
              <View style={styles.activityCard}>
                <Text style={styles.activityLabel}>Latest Update</Text>
                <Text style={styles.activityTitle}>{latestActivity.title}</Text>
                {latestActivity.completed_at ? (
                  <Text style={styles.activityMeta}>{new Date(latestActivity.completed_at).toLocaleString()}</Text>
                ) : null}
              </View>
            ) : (
              <View style={styles.activityCard}>
                <Text style={styles.activityLabel}>Latest Update</Text>
                <Text style={styles.helper}>No recent updates yet.</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
      {requestId ? (
        <View style={styles.debugCard}>
          <Text style={styles.debugLabel}>request_id: {requestId}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function getStatusBadge(percent: number) {
  if (percent >= 80) {
    return { label: "On Track", style: styles.badgeGreen, textStyle: styles.badgeGreenText };
  }
  if (percent < 50) {
    return { label: "Needs Focus", style: styles.badgeAmber, textStyle: styles.badgeAmberText };
  }
  return { label: "Steady", style: styles.badgeBlue, textStyle: styles.badgeBlueText };
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FAFAF8",
  },
  container: {
    padding: 20,
    gap: 12,
  },
  summaryCard: {
    backgroundColor: "#2D3748",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  summaryTitle: {
    color: "#fff",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "600",
  },
  summaryStat: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
    marginTop: 8,
  },
  summaryBar: {
    height: 16,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginTop: 12,
  },
  summaryFill: {
    height: "100%",
    borderRadius: 999,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  cardComplete: {
    opacity: 0.6,
  },
  cardWarning: {
    borderColor: "#FED7AA",
    backgroundColor: "#FFF7ED",
  },
  headerTitle: {
    fontSize: 30,
    color: "#2D3748",
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitleWrapper: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2D3748",
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    fontWeight: "600",
  },
  badgeGreen: {
    backgroundColor: "#DCFCE7",
  },
  badgeGreenText: {
    color: "#15803D",
  },
  badgeBlue: {
    backgroundColor: "#DBEAFE",
  },
  badgeBlueText: {
    color: "#1D4ED8",
  },
  badgeAmber: {
    backgroundColor: "#FEF3C7",
  },
  badgeAmberText: {
    color: "#B45309",
  },
  progressRow: {
    marginTop: 8,
  },
  progressBar: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#6B8DBF",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  meta: {
    color: "#6B7280",
  },
  activityCard: {
    marginTop: 14,
    backgroundColor: "#FAFAF8",
    borderRadius: 16,
    padding: 12,
  },
  activityLabel: {
    fontWeight: "600",
    color: "#1F2933",
  },
  activityTitle: {
    marginTop: 4,
    fontWeight: "600",
    color: "#111827",
  },
  activityMeta: {
    color: "#6B7280",
    marginTop: 4,
    fontSize: 12,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#FAFAF8",
  },
  helper: {
    marginTop: 8,
    color: "#6B7280",
    textAlign: "center",
  },
  error: {
    color: "#c62828",
    fontSize: 16,
    textAlign: "center",
  },
  retry: {
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#6B8DBF",
  },
  retryText: {
    color: "#6B8DBF",
    fontWeight: "600",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111",
  },
  debugCard: {
    padding: 12,
    borderTopWidth: 1,
    borderColor: "#e6e9f2",
  },
  debugLabel: {
    color: "#111",
  },
});
