import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, TouchableOpacity, Platform } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../types/navigation";
import { fetchDashboard, DashboardResolution } from "../api/dashboard";
import { getResolution, PlanMilestone } from "../api/resolutions";
import { listTasks, TaskItem } from "../api/tasks";
import { useUserId } from "../state/user";
import { Calendar, CheckCircle, Clock } from "lucide-react-native";
import { formatScheduleLabel, sortTasksBySchedule } from "../utils/datetime";
import { useTheme } from "../theme";
import type { ThemeTokens } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "ResolutionDashboardDetail">;

export default function ResolutionDashboardDetailScreen({ route }: Props) {
  const { resolutionId } = route.params;
  const { userId, loading: userLoading } = useUserId();
  const { theme } = useTheme();
  const [resolution, setResolution] = useState<DashboardResolution | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<PlanMilestone[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(1);

  const backgroundColor = theme.background;
  const surface = theme.card;
  const surfaceMuted = theme.surfaceMuted;
  const borderColor = theme.border;
  const textPrimary = theme.textPrimary;
  const textSecondary = theme.textSecondary;
  const accent = theme.accent;
  const shadowColor = theme.shadow;

  const loadData = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [{ dashboard }, { resolution: resolutionDetail }, { tasks: list }] = await Promise.all([
        fetchDashboard(userId),
        getResolution(resolutionId, userId),
        listTasks(userId, { status: "active" }),
      ]);
      const entry = dashboard.active_resolutions.find((item) => item.resolution_id === resolutionId) || null;
      setResolution(entry);
      setTasks(list);
      setMilestones(resolutionDetail.plan?.milestones ?? []);
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

  useEffect(() => {
    if (resolution) {
      setSelectedWeek(resolution.current_week ?? 1);
    }
  }, [resolution?.resolution_id, resolution?.current_week]);

  const totalWeeks = resolution?.duration_weeks ?? 12;
  const currentWeek = resolution?.current_week ?? 1;

  const baseWeekStart = useMemo(() => {
    if (!resolution?.week.start) return null;
    const parsed = new Date(resolution.week.start);
    if (Number.isNaN(parsed.getTime())) return null;
    const offsetWeeks = currentWeek > 0 ? currentWeek - 1 : 0;
    const base = new Date(parsed);
    base.setDate(base.getDate() - offsetWeeks * 7);
    return base;
  }, [resolution?.week.start, currentWeek]);

  const selectedWeekRange = useMemo(() => {
    if (!baseWeekStart) return null;
    const start = new Date(baseWeekStart);
    start.setDate(start.getDate() + (selectedWeek - 1) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start, end };
  }, [baseWeekStart, selectedWeek]);

  const weekRangeLabel = useMemo(() => {
    if (selectedWeekRange) {
      return formatWeekRangeLabel(selectedWeekRange.start, selectedWeekRange.end);
    }
    if (resolution?.week) {
      const fallbackStart = formatScheduleLabel(resolution.week.start, null) ?? resolution.week.start;
      const fallbackEnd = formatScheduleLabel(resolution.week.end, null) ?? resolution.week.end;
      return `${fallbackStart} - ${fallbackEnd}`;
    }
    return null;
  }, [resolution?.week, selectedWeekRange]);

  const resolutionTasks = useMemo(
    () => tasks.filter((task) => task.resolution_id === resolutionId),
    [tasks, resolutionId],
  );

  const selectedWeekTasks = useMemo(() => {
    if (!resolutionTasks.length) {
      return { scheduled: [] as TaskItem[], unscheduled: [] as TaskItem[] };
    }
    const unscheduled = resolutionTasks.filter((task) => !task.scheduled_day);
    if (!selectedWeekRange) {
      return {
        scheduled: resolutionTasks.filter((task) => !!task.scheduled_day),
        unscheduled,
      };
    }
    const scheduled = resolutionTasks.filter((task) => {
      if (!task.scheduled_day) return false;
      const date = new Date(task.scheduled_day);
      if (Number.isNaN(date.getTime())) return false;
      return date >= selectedWeekRange.start && date <= selectedWeekRange.end;
    });
    return { scheduled, unscheduled };
  }, [resolutionTasks, selectedWeekRange]);

  const includeUnscheduled = selectedWeek === currentWeek;
  const combinedTasks = includeUnscheduled
    ? [...selectedWeekTasks.scheduled, ...selectedWeekTasks.unscheduled]
    : [...selectedWeekTasks.scheduled];
  const orderedTasks = sortTasksBySchedule(combinedTasks);
  const remainingFlow = orderedTasks.filter((task) => !task.completed);
  const completedWins = orderedTasks.filter((task) => task.completed);
  const selectedMilestone = milestones.find((milestone) => milestone.week === selectedWeek);
  const defaultFocus = "Building consistency with daily actions.";
  const upcomingWeek = selectedWeek > currentWeek;

  if (userLoading || loading || !resolution) {
    return (
      <View style={[styles.center, { backgroundColor }]}>
        {error ? (
          <>
            <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
            <Text style={[styles.helper, { color: textSecondary }]}>Pull down to retry.</Text>
          </>
        ) : (
          <>
            <ActivityIndicator color={accent} />
            <Text style={[styles.helper, { color: textSecondary }]}>Loading your journey…</Text>
          </>
        )}
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor }}
      contentContainerStyle={[styles.container, { backgroundColor }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: textPrimary }]}>{resolution.title}</Text>
      <Text style={[styles.subtitle, { color: textSecondary }]}>
        Viewing week {selectedWeek} of {resolution.duration_weeks ?? "Flexible"}
        {selectedWeek !== currentWeek ? ` • Current: W${currentWeek}` : ""}
      </Text>
      <View style={[styles.progressBar, { backgroundColor: surfaceMuted }]}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.round(resolution.completion_rate * 100)}%`, backgroundColor: accent },
          ]}
        />
      </View>

      <View style={styles.timelineSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeline}>
          {Array.from({ length: totalWeeks }, (_, index) => {
            const weekNumber = index + 1;
            const state = weekNumber < currentWeek ? "past" : weekNumber === currentWeek ? "current" : "future";
            const isSelected = weekNumber === selectedWeek;
            const pillTheme = getWeekPillTheme(state, theme, isSelected);
            return (
              <TouchableOpacity
                key={weekNumber}
                style={[
                  styles.weekPill,
                  { backgroundColor: pillTheme.backgroundColor, borderColor: pillTheme.borderColor },
                ]}
                onPress={() => setSelectedWeek(weekNumber)}
                activeOpacity={0.85}
              >
                {state === "past" ? <CheckCircle size={16} color={pillTheme.iconColor} /> : null}
                <Text
                  style={[
                    styles.weekLabel,
                    { color: pillTheme.labelColor },
                  ]}
                >
                  W{weekNumber}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={styles.weekRangeRow}>
          <Calendar size={16} color={textSecondary} />
          <Text style={[styles.weekRange, { color: textSecondary }]}>{weekRangeLabel}</Text>
        </View>
      </View>

      {selectedMilestone ? (
        <View style={[styles.focusCard, { backgroundColor: surface, borderColor, shadowColor }]}>
          <Text style={[styles.sectionLabel, { color: textPrimary }]}>Week {selectedWeek} Focus</Text>
          <Text style={[styles.focusText, { color: textSecondary }]}>{selectedMilestone.focus || defaultFocus}</Text>
          {selectedMilestone.success_criteria?.length ? (
            <View style={styles.goalList}>
              {selectedMilestone.success_criteria.map((criterion, idx) => (
                <Text key={`criterion-${idx}`} style={[styles.goalBullet, { color: textSecondary }]}>
                  • {criterion}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: textPrimary }]}>Remaining Flow</Text>
        {remainingFlow.length ? (
          remainingFlow.map((task) => (
            <View
              key={task.id}
              style={[styles.taskCard, { backgroundColor: surface, borderColor, shadowColor }]}
            >
              <View style={[styles.checkbox, { borderColor, backgroundColor: surfaceMuted }]}>
                <Clock size={16} color={textSecondary} />
              </View>
              <View style={styles.taskContent}>
                <Text style={[styles.taskTitle, { color: textPrimary }]}>{task.title}</Text>
                <Text style={[styles.taskMeta, { color: textSecondary }]}>
                  {formatScheduleLabel(task.scheduled_day, task.scheduled_time)}
                </Text>
              </View>
            </View>
          ))
        ) : upcomingWeek ? (
          <Text style={[styles.helper, { color: textSecondary }]}>
            Tasks for this week will populate once the week begins.
          </Text>
        ) : (
          <Text style={[styles.helper, { color: textSecondary }]}>Everything scheduled for this week is complete.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: textPrimary }]}>Completed Wins</Text>
        {completedWins.length ? (
          completedWins.map((task) => (
            <View
              key={task.id}
              style={[
                styles.taskCard,
                styles.completedCard,
                { backgroundColor: surface, borderColor, shadowColor },
              ]}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: accent,
                    backgroundColor: accent,
                  },
                ]}
              >
                <CheckCircle size={16} color="#fff" />
              </View>
              <View style={styles.taskContent}>
                <Text style={[styles.taskTitle, styles.completedText, { color: textSecondary }]}>{task.title}</Text>
                {task.note ? (
                  <Text style={[styles.taskMeta, { color: textSecondary }]}>Note: {task.note}</Text>
                ) : null}
              </View>
            </View>
          ))
        ) : selectedWeek === currentWeek ? (
          <Text style={[styles.helper, { color: textSecondary }]}>No wins logged yet.</Text>
        ) : (
          <Text style={[styles.helper, { color: textSecondary }]}>
            We’ll track wins once this week is underway.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

type WeekState = "past" | "current" | "future";

function formatWeekRangeLabel(start: Date, end: Date) {
  const formatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function getWeekPillTheme(state: WeekState, theme: ThemeTokens, selected: boolean) {
  if (selected) {
    return {
      backgroundColor: theme.accent,
      labelColor: "#fff",
      iconColor: "#fff",
      borderColor: theme.accent,
    };
  }
  switch (state) {
    case "past":
      return {
        backgroundColor: theme.surfaceMuted,
        labelColor: theme.textSecondary,
        iconColor: theme.textSecondary,
        borderColor: theme.surfaceMuted,
      };
    case "current":
      return {
        backgroundColor: theme.accent,
        labelColor: "#fff",
        iconColor: "#fff",
        borderColor: theme.accent,
      };
    case "future":
    default:
      return {
        backgroundColor: theme.cardMuted,
        labelColor: theme.textMuted,
        iconColor: theme.textMuted,
        borderColor: theme.cardMuted,
      };
  }
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
    borderWidth: 1,
  },
  weekLabel: {
    fontWeight: "600",
    color: "#4B5563",
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
  goalList: {
    marginTop: 10,
    gap: 4,
  },
  goalBullet: {
    color: "#475569",
    fontSize: 13,
  },
  milestoneCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  milestoneWeek: {
    fontWeight: "700",
    color: "#1F2933",
  },
  milestoneFocus: {
    marginTop: 4,
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
