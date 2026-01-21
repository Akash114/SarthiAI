import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, TouchableOpacity, Platform } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../types/navigation";
import { fetchDashboard, DashboardResolution } from "../api/dashboard";
import { listTasks, TaskItem } from "../api/tasks";
import { useUserId } from "../state/user";
import { Calendar, CheckCircle, Clock } from "lucide-react-native";
import { formatScheduleLabel, sortTasksBySchedule } from "../utils/datetime";

type Props = NativeStackScreenProps<RootStackParamList, "ResolutionDashboardDetail">;

export default function ResolutionDashboardDetailScreen({ route }: Props) {
  const { resolutionId } = route.params;
  const { userId, loading: userLoading } = useUserId();
  const [resolution, setResolution] = useState<DashboardResolution | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filterWeekTasks = useMemo(() => {
    if (!resolution) return { scheduled: [], unscheduled: [] as TaskItem[] };
    const start = new Date(resolution.week.start);
    const end = new Date(resolution.week.end);
    const weekTasks = tasks.filter((task) => task.resolution_id === resolutionId);
    const scheduled = weekTasks.filter((task) => {
      if (!task.scheduled_day) return false;
      const day = new Date(task.scheduled_day);
      return day >= start && day <= end;
    });
    const unscheduled = weekTasks.filter((task) => !task.scheduled_day);
    return { scheduled, unscheduled };
  }, [tasks, resolution, resolutionId]);

  const loadData = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { dashboard } = await fetchDashboard(userId);
      const entry = dashboard.active_resolutions.find((item) => item.resolution_id === resolutionId) || null;
      setResolution(entry);
      const { tasks: list } = await listTasks(userId, { status: "active" });
      setTasks(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load this resolution.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userLoading && userId) {
      loadData();
    }
  }, [userLoading, userId]);

  if (userLoading || loading || !resolution) {
    return (
      <View style={styles.center}>
        {error ? (
          <>
            <Text style={styles.error}>{error}</Text>
            <Text style={styles.helper}>Pull down to retry.</Text>
          </>
        ) : (
          <>
            <ActivityIndicator color="#6B8DBF" />
            <Text style={styles.helper}>Loading your journey…</Text>
          </>
        )}
      </View>
    );
  }

  const totalWeeks = resolution.duration_weeks ?? 12;
  const currentWeek = resolution.current_week ?? 1;
  const weekStartLabel = formatScheduleLabel(resolution.week.start, null) ?? resolution.week.start;
  const weekEndLabel = formatScheduleLabel(resolution.week.end, null) ?? resolution.week.end;
  const weekRange = `${weekStartLabel} - ${weekEndLabel}`;
  const combinedTasks = [...filterWeekTasks.scheduled, ...filterWeekTasks.unscheduled];
  const orderedTasks = sortTasksBySchedule(combinedTasks);
  const remainingFlow = orderedTasks.filter((task) => !task.completed);
  const completedWins = orderedTasks.filter((task) => task.completed);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{resolution.title}</Text>
      <Text style={styles.subtitle}>
        Week {currentWeek} of {resolution.duration_weeks ?? "Flexible"}
      </Text>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${Math.round(resolution.completion_rate * 100)}%` }]} />
      </View>

      <View style={styles.timelineSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeline}>
          {Array.from({ length: totalWeeks }, (_, index) => {
            const weekNumber = index + 1;
            const state = weekNumber < currentWeek ? "past" : weekNumber === currentWeek ? "current" : "future";
            return (
              <View
                key={weekNumber}
                style={[
                  styles.weekPill,
                  state === "past" && styles.weekPillPast,
                  state === "current" && styles.weekPillCurrent,
                  state === "future" && styles.weekPillFuture,
                ]}
              >
                {state === "past" ? <CheckCircle size={16} color="#6B7280" /> : null}
                <Text
                  style={[
                    styles.weekLabel,
                    state === "current" && styles.weekLabelCurrent,
                    state === "future" && styles.weekLabelFuture,
                  ]}
                >
                  W{weekNumber}
                </Text>
              </View>
            );
          })}
        </ScrollView>
        <View style={styles.weekRangeRow}>
          <Calendar size={16} color="#6B7280" />
          <Text style={styles.weekRange}>{weekRange}</Text>
        </View>
      </View>

      <View style={styles.focusCard}>
        <Text style={styles.sectionLabel}>Current Focus</Text>
        <Text style={styles.focusText}>Building consistency with daily actions.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Remaining Flow</Text>
        {remainingFlow.length ? (
          remainingFlow.map((task) => (
            <View key={task.id} style={styles.taskCard}>
              <View style={styles.checkbox}>
                <Clock size={16} color="#6B7280" />
              </View>
              <View style={styles.taskContent}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.taskMeta}>{formatScheduleLabel(task.scheduled_day, task.scheduled_time)}</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.helper}>Everything scheduled for this week is complete.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Completed Wins</Text>
        {completedWins.length ? (
          completedWins.map((task) => (
            <View key={task.id} style={[styles.taskCard, styles.completedCard]}>
              <View style={[styles.checkbox, styles.checkboxDone]}>
                <CheckCircle size={16} color="#fff" />
              </View>
              <View style={styles.taskContent}>
                <Text style={[styles.taskTitle, styles.completedText]}>{task.title}</Text>
                {task.note ? <Text style={styles.taskMeta}>Note: {task.note}</Text> : null}
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.helper}>No wins logged yet.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 16,
    backgroundColor: "#FAFAF8",
  },
  title: {
    fontSize: 30,
    color: "#2D3748",
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
  },
  subtitle: {
    color: "#6B7280",
    fontFamily: Platform.select({ ios: "System", default: "sans-serif" }),
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
  timelineSection: {
    marginTop: 12,
  },
  timeline: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 8,
  },
  weekPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  weekPillPast: {
    backgroundColor: "#E5E7EB",
  },
  weekPillCurrent: {
    backgroundColor: "#6B8DBF",
  },
  weekPillFuture: {
    backgroundColor: "#F1F5F9",
  },
  weekLabel: {
    fontWeight: "600",
    color: "#4B5563",
  },
  weekLabelCurrent: {
    color: "#fff",
  },
  weekLabelFuture: {
    color: "#94A3B8",
  },
  weekRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  weekRange: {
    marginTop: 6,
    color: "#6B7280",
    fontFamily: Platform.select({ ios: "System", default: "sans-serif" }),
  },
  focusCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  section: {
    backgroundColor: "transparent",
  },
  sectionLabel: {
    fontWeight: "600",
    color: "#1F2933",
    marginBottom: 12,
  },
  focusText: {
    color: "#475569",
  },
  taskCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    marginBottom: 8,
  },
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  checkboxDone: {
    backgroundColor: "#6B8DBF",
    borderColor: "#6B8DBF",
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontWeight: "600",
    color: "#1F2933",
  },
  taskMeta: {
    color: "#6B7280",
    marginTop: 4,
  },
  completedCard: {
    opacity: 0.6,
  },
  completedText: {
    textDecorationLine: "line-through",
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
});
