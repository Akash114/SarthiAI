import { useCallback, useEffect, useRef, useState } from "react";
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
import { Sun, Circle } from "lucide-react-native";
import { getWeeklyPlanLatest, runWeeklyPlan, WeeklyPlanResponse } from "../api/weeklyPlan";
import { useUserId } from "../state/user";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../types/navigation";
import { useActiveResolutions } from "../hooks/useActiveResolutions";
import { useTheme } from "../theme";

type WeeklyPlanNav = NativeStackNavigationProp<RootStackParamList, "WeeklyPlan">;

export default function WeeklyPlanScreen() {
  const { userId, loading: userLoading } = useUserId();
  const navigation = useNavigation<WeeklyPlanNav>();
  const { theme } = useTheme();
  const {
    hasActiveResolutions,
    loading: activeResolutionsLoading,
    refresh: refreshActiveResolutions,
  } = useActiveResolutions(userId);
  const [plan, setPlan] = useState<WeeklyPlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState(false);
  const backgroundColor = theme.background;
  const surface = theme.card;
  const borderColor = theme.border;
  const textPrimary = theme.textPrimary;
  const textSecondary = theme.textSecondary;
  const accent = theme.accent;

  const fetchPlan = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { plan: data, requestId: reqId, notFound: none } = await getWeeklyPlanLatest(userId);
      setPlan(data);
      setRequestId(reqId);
      setNotFound(none);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load weekly plan.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userLoading && userId && hasActiveResolutions !== null) {
      if (hasActiveResolutions) {
        fetchPlan();
      } else {
        setPlan(null);
        setLoading(false);
        setNotFound(true);
      }
    }
  }, [fetchPlan, userId, userLoading, hasActiveResolutions]);

  const hasRunInitialFocus = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasRunInitialFocus.current) {
        hasRunInitialFocus.current = true;
        return;
      }
      refreshActiveResolutions();
    }, [refreshActiveResolutions]),
  );

  const handleGenerate = async () => {
    if (!userId) return;
    setRunning(true);
    setError(null);
    try {
      const { plan: data, requestId: reqId } = await runWeeklyPlan(userId);
      setPlan(data);
      setRequestId(reqId);
      setNotFound(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate weekly plan.");
    } finally {
      setRunning(false);
    }
  };

  if (!userLoading && !activeResolutionsLoading && hasActiveResolutions === false) {
    return (
      <View style={[styles.center, { backgroundColor }]}>
        <Text style={[styles.emptyTitle, { color: textPrimary }]}>Start with a resolution</Text>
        <Text style={[styles.helper, { color: textSecondary }]}>Create a resolution to unlock weekly planning.</Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: accent }]}
          onPress={() => navigation.navigate("ResolutionCreate")}
        >
          <Text style={styles.buttonText}>Create Resolution</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkButton} onPress={refreshActiveResolutions}>
          <Text style={[styles.linkText, { color: accent }]}>Check again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if ((userLoading || loading || activeResolutionsLoading) && !refreshing) {
    return (
      <View style={[styles.center, { backgroundColor }]}>
        <ActivityIndicator color={accent} />
        <Text style={[styles.helper, { color: textSecondary }]}>Fetching your weekly snapshot…</Text>
      </View>
    );
  }

  const dateLabel = plan ? formatRange(plan.week.start, plan.week.end) : "";

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPlan(); }} tintColor={accent} />
      }
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: textPrimary }]}>Weekly Plan</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate("WeeklyPlanHistory")}>
            <Text style={[styles.linkText, { color: accent }]}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.updateButton, { backgroundColor: accent }, running && styles.buttonDisabled]}
            onPress={handleGenerate}
            disabled={running}
          >
            {running ? <ActivityIndicator color="#fff" /> : <Text style={styles.updateText}>Update Plan</Text>}
          </TouchableOpacity>
        </View>
      </View>
      {error ? (
        <View style={[styles.errorBox, { backgroundColor: theme.accentSoft }]}>
          <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryButton, { borderColor: theme.danger }]} onPress={fetchPlan}>
            <Text style={[styles.retryText, { color: theme.danger }]}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {plan ? (
        <>
          <View style={[styles.focusCard, { backgroundColor: surface, borderColor, shadowColor: theme.shadow }]}>
            <Text style={[styles.dateLabel, { color: textSecondary }]}>{dateLabel}</Text>
            <Text style={[styles.focusTitle, { color: textPrimary }]}>{plan.micro_resolution.title}</Text>
            <Text style={[styles.focusBody, { color: textSecondary }]}>{plan.micro_resolution.why_this}</Text>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Suggested Actions</Text>
          </View>
          {plan.micro_resolution.suggested_week_1_tasks.map((task) => (
            <View key={task.title} style={[styles.taskRow, { backgroundColor: surface, borderColor }]}>
              <Circle size={10} color={accent} />
              <View style={styles.taskContent}>
                <Text style={[styles.taskTitle, { color: textPrimary }]}>{task.title}</Text>
                <Text style={[styles.taskMeta, { color: textSecondary }]}>
                  {task.duration_min ? `${task.duration_min} min` : "Flexible"}
                  {task.suggested_time ? ` · ${task.suggested_time}` : ""}
                </Text>
              </View>
            </View>
          ))}

          <View style={[styles.debugBox, { backgroundColor: theme.surfaceMuted }]}>
            <Text style={[styles.debugLabel, { color: textSecondary }]}>Req ID: {requestId || plan.request_id || "—"}</Text>
            <Text style={[styles.debugLabel, { color: textSecondary }]}>
              Completion: {(plan.inputs.completion_rate * 100).toFixed(0)}%
            </Text>
          </View>
        </>
      ) : null}

      {!plan && hasActiveResolutions ? (
        <View style={[styles.emptyState, { backgroundColor: surface, borderColor }]}>
          <Sun size={48} color="#FDBA74" />
          <Text style={[styles.emptyTitle, { color: textPrimary }]}>Ready to plan your week?</Text>
          <Text style={[styles.helper, { color: textSecondary }]}>Let&apos;s find your focus.</Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: accent }, running && styles.buttonDisabled]}
            onPress={handleGenerate}
            disabled={running}
          >
            {running ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Generate Plan</Text>}
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}

function formatRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const formatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  const upper = (date: Date) => formatter.format(date).toUpperCase();
  return `${upper(startDate)} – ${upper(endDate)}`;
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 16,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 30,
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  linkButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  linkText: {
    fontWeight: "600",
  },
  updateButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  updateText: {
    color: "#fff",
    fontWeight: "600",
  },
  focusCard: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    marginBottom: 12,
  },
  dateLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  focusTitle: {
    fontSize: 28,
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    marginTop: 8,
  },
  focusBody: {
    marginTop: 12,
    fontStyle: "italic",
    fontSize: 16,
  },
  sectionHeader: {
    marginTop: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontWeight: "600",
  },
  taskMeta: {
    marginTop: 4,
  },
  button: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  helper: {
    marginTop: 8,
    textAlign: "center",
  },
  emptyState: {
    marginTop: 24,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: 12,
  },
  error: {
    fontWeight: "600",
  },
  errorBox: {
    borderRadius: 12,
    padding: 12,
  },
  retryButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  retryText: {
    fontWeight: "600",
  },
  debugBox: {
    marginTop: 16,
    padding: 8,
    borderRadius: 8,
  },
  debugLabel: {
    fontSize: 12,
    textAlign: "center",
  },
});
