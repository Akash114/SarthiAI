import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  approveResolution,
  decomposeResolution,
  PlanMilestone,
  WeekOneTask,
  TaskEditPayload,
  ApprovalResponse,
  getResolution,
  ResolutionDetail,
} from "../api/resolutions";
import { useUserId } from "../state/user";
import type { RootStackParamList } from "../../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "PlanReview">;

type EditableTask = {
  id: string;
  title: string;
  scheduled_day: string;
  scheduled_time: string;
  duration_min: string;
  original: WeekOneTask;
};

export default function PlanReviewScreen({ route, navigation }: Props) {
  const { resolutionId, initialResolution } = route.params;
  const { userId, loading: userLoading } = useUserId();
  const [loading, setLoading] = useState(true);
  const [planRequestId, setPlanRequestId] = useState<string | null>(null);
  const [approvalRequestId, setApprovalRequestId] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ title: string; type: string; duration_weeks: number | null; plan: { weeks: number; milestones: PlanMilestone[] } } | null>(initialResolution ? {
    title: initialResolution.title,
    type: initialResolution.type,
    duration_weeks: initialResolution.duration_weeks,
    plan: {
      weeks: initialResolution.duration_weeks ?? 8,
      milestones: [],
    },
  } : null);
  const [tasks, setTasks] = useState<EditableTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState<ApprovalResponse | null>(null);

  const defaultWeeks = useMemo(() => initialResolution?.duration_weeks ?? undefined, [initialResolution]);

  const mapTasks = useCallback((rawTasks: WeekOneTask[]): EditableTask[] => {
    return rawTasks.map((task) => ({
      id: task.id,
      title: task.title,
      scheduled_day: task.scheduled_day ?? "",
      scheduled_time: task.scheduled_time ?? "",
      duration_min: task.duration_min != null ? String(task.duration_min) : "",
      original: task,
    }));
  }, []);

  const fetchPlan = useCallback(
    async (options: { regenerate?: boolean; userId?: string } = {}) => {
      const { regenerate = false, userId: uid } = options;
      if (!uid) {
        setError("Missing user id.");
        return;
      }
      setLoading(true);
      setError(null);
      setSuccess(null);
      try {
        const { resolution, requestId } = await getResolution(resolutionId, uid);
        const planData = resolution.plan;
        const hasDraftTasks = resolution.draft_tasks.length > 0;
        if (planData && hasDraftTasks && !regenerate) {
          setPlan({
            title: resolution.title,
            type: resolution.type,
            duration_weeks: resolution.duration_weeks,
            plan: planData,
          });
          setTasks(mapTasks(resolution.draft_tasks));
          setPlanRequestId(requestId);
          return;
        }

        const shouldDecompose = regenerate || !planData || !hasDraftTasks;
        if (shouldDecompose) {
          const body: { weeks?: number; regenerate?: boolean } = {};
          if (defaultWeeks && defaultWeeks >= 4 && defaultWeeks <= 12) {
            body.weeks = defaultWeeks;
          }
          if (regenerate) body.regenerate = true;
          const { result, requestId: decompId } = await decomposeResolution(resolutionId, body);
          setPlan({
            title: result.title,
            type: result.type,
            duration_weeks: result.duration_weeks,
            plan: result.plan,
          });
          setTasks(mapTasks(result.week_1_tasks));
          setPlanRequestId(decompId);
        } else if (planData) {
          setPlan({
            title: resolution.title,
            type: resolution.type,
            duration_weeks: resolution.duration_weeks,
            plan: planData,
          });
          setTasks(mapTasks(resolution.draft_tasks));
          setPlanRequestId(requestId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load plan.");
      } finally {
        setLoading(false);
      }
    },
    [resolutionId, defaultWeeks, mapTasks],
  );

  useEffect(() => {
    if (!userLoading && userId) {
      fetchPlan({ userId });
    }
  }, [fetchPlan, userLoading, userId]);

  const updateTaskField = (taskId: string, field: keyof EditableTask, value: string) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, [field]: value } : task)),
    );
  };

  const validateTasks = (): string | null => {
    for (const task of tasks) {
      if (task.scheduled_day && !/^\d{4}-\d{2}-\d{2}$/.test(task.scheduled_day)) {
        return `Use YYYY-MM-DD for ${task.title}.`;
      }
      if (task.scheduled_time && !/^\d{2}:\d{2}$/.test(task.scheduled_time)) {
        return `Use HH:MM for ${task.title}.`;
      }
      if (task.duration_min && (!/^\d+$/.test(task.duration_min) || Number(task.duration_min) <= 0)) {
        return `Duration for ${task.title} should be a positive number of minutes.`;
      }
    }
    return null;
  };

  const buildTaskEdits = (): TaskEditPayload[] => {
    const edits: TaskEditPayload[] = [];
    for (const task of tasks) {
      const payload: TaskEditPayload = { task_id: task.id };
      let changed = false;
      const trimmedTitle = task.title.trim();
      if (trimmedTitle && trimmedTitle !== task.original.title) {
        payload.title = trimmedTitle;
        changed = true;
      }
      if (task.scheduled_day && task.scheduled_day !== (task.original.scheduled_day ?? "")) {
        payload.scheduled_day = task.scheduled_day;
        changed = true;
      }
      if (task.scheduled_time && task.scheduled_time !== (task.original.scheduled_time ?? "")) {
        payload.scheduled_time = task.scheduled_time;
        changed = true;
      }
      if (task.duration_min) {
        const durationValue = Number(task.duration_min);
        if (task.original.duration_min !== durationValue) {
          payload.duration_min = durationValue;
          changed = true;
        }
      }
      if (changed) {
        edits.push(payload);
      }
    }
    return edits;
  };

  const handleAccept = async () => {
    if (!userId || userLoading) return;
    const validationError = validateTasks();
    if (validationError) {
      setError(validationError);
      return;
    }
    setPending(true);
    setError(null);
    setApprovalRequestId(null);
    try {
      const task_edits = buildTaskEdits();
      const { result, requestId } = await approveResolution(resolutionId, {
        user_id: userId,
        decision: "accept",
        task_edits,
      });

      setSuccess(result);
      setApprovalRequestId(requestId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to approve this plan right now.");
    } finally {
      setPending(false);
    }
  };

  const handleReject = async () => {
    if (!userId) return;
    try {
      await approveResolution(resolutionId, { user_id: userId, decision: "reject" });
      Alert.alert("Captured", "Plan kept in draft. Feel free to revisit anytime.");
      navigation.navigate("Home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update the plan right now.");
    }
  };

  const handleRegenerate = () => {
    if (!userId) return;
    fetchPlan({ regenerate: true, userId });
  };

  const debugRequestId = approvalRequestId || planRequestId || success?.request_id || null;
  const acceptDisabled = pending || userLoading || !userId || !plan || !tasks.length || !!success;

  if ((loading || userLoading) && !plan) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.helper}>Generating a friendly outline…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {plan ? (
        <>
          <Text style={styles.title}>{plan.title}</Text>
          <Text style={styles.subtitle}>
            {plan.type} · {plan.plan.weeks} weeks
          </Text>
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {plan ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Milestones</Text>
          {plan.plan.milestones.map((milestone) => (
            <View key={milestone.week} style={styles.milestone}>
              <Text style={styles.weekHeading}>Week {milestone.week}</Text>
              <Text style={styles.focus}>{milestone.focus}</Text>
              {milestone.success_criteria.map((criteria) => (
                <Text key={criteria} style={styles.criteria}>
                  • {criteria}
                </Text>
              ))}
            </View>
          ))}
        </View>
      ) : null}

      {tasks.length ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Week 1 Tasks</Text>
          {tasks.map((task) => (
            <View key={task.id} style={styles.taskBlock}>
              <TextInput
                style={styles.taskTitle}
                value={task.title}
                onChangeText={(value) => updateTaskField(task.id, "title", value)}
                placeholder="Task title"
                editable={!pending && !success}
              />
              <View style={styles.inlineInputs}>
                <TextInput
                  style={[styles.inlineInput, styles.flex]}
                  placeholder="YYYY-MM-DD"
                  value={task.scheduled_day}
                  onChangeText={(value) => updateTaskField(task.id, "scheduled_day", value)}
                  editable={!pending && !success}
                />
                <TextInput
                  style={[styles.inlineInput, styles.flex]}
                  placeholder="HH:MM"
                  value={task.scheduled_time}
                  onChangeText={(value) => updateTaskField(task.id, "scheduled_time", value)}
                  editable={!pending && !success}
                />
                <TextInput
                  style={[styles.inlineInput, styles.flex]}
                  placeholder="Minutes"
                  keyboardType="number-pad"
                  value={task.duration_min}
                  onChangeText={(value) => updateTaskField(task.id, "duration_min", value.replace(/[^0-9]/g, ""))}
                  editable={!pending && !success}
                />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {success ? (
        <View style={styles.successCard}>
          <Text style={styles.sectionTitle}>Activated Tasks</Text>
          {success.tasks_activated?.map((task) => (
            <View key={task.id} style={styles.taskSummary}>
              <Text style={styles.summaryTitle}>{task.title}</Text>
              <Text style={styles.summaryMeta}>
                {task.scheduled_day || "Flexible"} · {task.scheduled_time || "Anytime"} · {task.duration_min ?? "—"} min
              </Text>
            </View>
          ))}
          <TouchableOpacity style={[styles.button, styles.primary]} onPress={() => navigation.navigate("Home")}>
            <Text style={styles.buttonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.button, styles.primary, acceptDisabled && styles.buttonDisabled]} onPress={handleAccept} disabled={acceptDisabled}>
            {pending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Accept Plan</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.secondary]} onPress={handleRegenerate} disabled={pending}>
            <Text style={[styles.buttonText, styles.secondaryText]}>Regenerate</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.ghost]} onPress={handleReject} disabled={pending}>
            <Text style={styles.ghostText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}

      {debugRequestId ? (
        <View style={styles.debugCard}>
          <Text style={styles.debugLabel}>Debug</Text>
          <Text style={styles.debugValue}>request_id: {debugRequestId}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flexGrow: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: "600",
    color: "#111",
  },
  subtitle: {
    color: "#555",
    marginTop: 4,
    marginBottom: 16,
  },
  error: {
    color: "#c62828",
    marginBottom: 12,
  },
  card: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e1e3e8",
    padding: 16,
    backgroundColor: "#fff",
  },
  sectionTitle: {
    fontWeight: "600",
    marginBottom: 8,
    fontSize: 16,
  },
  milestone: {
    marginBottom: 12,
  },
  weekHeading: {
    fontWeight: "600",
    color: "#1a73e8",
  },
  focus: {
    marginTop: 4,
    color: "#222",
  },
  criteria: {
    color: "#444",
    marginLeft: 8,
    marginTop: 2,
  },
  taskBlock: {
    marginBottom: 16,
  },
  taskTitle: {
    borderWidth: 1,
    borderColor: "#d7dae0",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  inlineInputs: {
    flexDirection: "row",
    columnGap: 8,
  },
  inlineInput: {
    borderWidth: 1,
    borderColor: "#d7dae0",
    borderRadius: 10,
    padding: 10,
  },
  flex: {
    flex: 1,
  },
  actionsRow: {
    marginTop: 16,
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  primary: {
    backgroundColor: "#1a73e8",
  },
  buttonDisabled: {
    backgroundColor: "#8fb5f8",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  secondary: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d0d5dd",
  },
  secondaryText: {
    color: "#1a73e8",
  },
  ghost: {
    backgroundColor: "transparent",
  },
  ghostText: {
    color: "#c62828",
    fontWeight: "600",
  },
  successCard: {
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#c8e6c9",
    padding: 16,
    backgroundColor: "#f1f8e9",
  },
  taskSummary: {
    marginBottom: 12,
  },
  summaryTitle: {
    fontWeight: "600",
  },
  summaryMeta: {
    color: "#555",
    marginTop: 2,
  },
  debugCard: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#f4f6fb",
    borderWidth: 1,
    borderColor: "#dfe3eb",
  },
  debugLabel: {
    fontWeight: "600",
    color: "#555",
  },
  debugValue: {
    marginTop: 4,
    color: "#111",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  helper: {
    marginTop: 8,
    color: "#555",
  },
});
