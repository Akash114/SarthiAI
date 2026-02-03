import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import DateTimePicker from "@react-native-community/datetimepicker";
import { approveResolution, TaskEditPayload, ApprovalResponse, WeekPlanTask } from "../api/resolutions";
import { useUserId } from "../state/user";
import { EditableTask, useResolutionPlan } from "../hooks/useResolutionPlan";
import { formatDisplayDate, formatScheduleLabel, sortTasksBySchedule } from "../utils/datetime";
import { requestCalendarPermissions, syncTaskToCalendar } from "../hooks/useCalendarSync";
import { useTaskSchedule } from "../hooks/useTaskSchedule";
import type { RootStackParamList } from "../../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "PlanReview">;

export default function PlanReviewScreen({ route, navigation }: Props) {
  const { resolutionId, initialResolution } = route.params;
  const { userId, loading: userLoading } = useUserId();
  const {
    plan,
    tasks,
    weeks,
    status: resolutionStatus,
    loading: planLoading,
    error: planError,
    setTasks,
    regenerate,
  } = useResolutionPlan({ resolutionId, userId, initialResolution });
  const { isSlotTaken } = useTaskSchedule(userId);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState<ApprovalResponse | null>(null);
  const [pickerState, setPickerState] = useState<{ taskId: string; mode: "date" | "time"; value: Date } | null>(null);
  const [newTaskIdCounter, setNewTaskIdCounter] = useState(0);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [syncingAll, setSyncingAll] = useState(false);

  const weekSections = useMemo(() => {
    if (weeks && weeks.length) {
      return weeks;
    }
    if (!plan) {
      return [];
    }
    return plan.plan.milestones.map((milestone) => ({
      week: milestone.week,
      focus: milestone.focus,
      tasks: [],
    }));
  }, [weeks, plan]);

  useEffect(() => {
    setSelectedWeek(1);
  }, [weekSections.length]);

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

  const addTask = () => {
    const nextId = `temp-${newTaskIdCounter + 1}`;
    setNewTaskIdCounter((prev) => prev + 1);
    const fallbackNote = "Add any resources or reminders that keep this task doable.";
    setTasks((prev) => [
      ...prev,
      {
        id: nextId,
        title: "",
        scheduled_day: "",
        scheduled_time: "",
        duration_min: "",
        note: fallbackNote,
        original: {
          id: nextId,
          title: "",
          scheduled_day: null,
          scheduled_time: null,
          duration_min: null,
          draft: true,
          note: fallbackNote,
        },
      },
    ]);
  };

  const openDatePicker = (task: EditableTask) => {
    const value = parseDate(task.scheduled_day) ?? new Date();
    setPickerState({
      taskId: task.id,
      mode: "date",
      value,
    });
  };

  const openTimePicker = (task: EditableTask) => {
    if (!task.scheduled_day) {
      Alert.alert("Pick a date", "Set a day before picking a time.");
      return;
    }
    const value = parseTime(task.scheduled_time) ?? new Date();
    setPickerState({
      taskId: task.id,
      mode: "time",
      value,
    });
  };

  const closePicker = () => setPickerState(null);

  const confirmPicker = () => {
    if (!pickerState) return;
    const target = tasks.find((task) => task.id === pickerState.taskId);
    if (!target) {
      closePicker();
      return;
    }
    const ignoreTimes = target.original?.scheduled_time ? [target.original.scheduled_time] : [];
    if (pickerState.mode === "date") {
      const formattedDay = formatDate(pickerState.value);
      if (target.scheduled_time && isSlotTaken(formattedDay, target.scheduled_time, { ignoreTimes })) {
        Alert.alert("Slot taken", "Another task already uses that day/time.");
        return;
      }
      updateTaskField(pickerState.taskId, "scheduled_day", formattedDay);
    } else {
      if (!target.scheduled_day) {
        Alert.alert("Pick a date", "Select a day before setting a time.");
        return;
      }
      const formattedTime = formatTime(pickerState.value);
      if (isSlotTaken(target.scheduled_day, formattedTime, { ignoreTimes })) {
        Alert.alert("Slot taken", "Another task already uses that time.");
        return;
      }
      updateTaskField(pickerState.taskId, "scheduled_time", formattedTime);
    }
    closePicker();
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
    try {
      const task_edits = buildTaskEdits();
      const { result } = await approveResolution(resolutionId, {
        user_id: userId,
        decision: "accept",
        task_edits,
      });

      setSuccess(result);
      Alert.alert(
        "Plan activated",
        "Do you want to add these tasks to your calendar now?",
        [
          { text: "Not now", style: "cancel" },
          { text: "Sync Tasks", onPress: () => handleSyncAll(result.tasks_activated ?? []) },
        ],
      );
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

  const handleSyncAll = async (approvedTasks: ApprovalResponse["tasks_activated"]) => {
    if (!approvedTasks?.length) {
      Alert.alert("Calendar", "No dated tasks ready to sync yet.");
      return;
    }
    try {
      const granted = await requestCalendarPermissions();
      if (!granted) {
        Alert.alert("Permission needed", "Calendar or reminders access was not granted.");
        return;
      }
      setSyncingAll(true);
      for (const task of approvedTasks) {
        if (!task.scheduled_day) continue;
        try {
          await syncTaskToCalendar({
            title: task.title,
            scheduled_day: task.scheduled_day,
            scheduled_time: task.scheduled_time,
            duration_min: task.duration_min,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unable to sync one of the tasks.";
          Alert.alert("Calendar warning", `${task.title}: ${message}`);
        }
      }
      Alert.alert("Calendar", "All dated tasks have been added to your calendar.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sync tasks right now.";
      Alert.alert("Calendar error", message);
    } finally {
      setSyncingAll(false);
    }
  };

  const handleRegenerate = () => {
    if (!userId) return;
    setError(null);
    setSuccess(null);
    regenerate();
  };

  const STATUS_MESSAGES = useMemo(
    () => [
      "Understanding your goal…",
      "Breaking it into manageable steps…",
      "Designing a sustainable weekly rhythm…",
      "Finding realistic time blocks…",
      "Finalizing your first week…",
    ],
    [],
  );
  const [showStatus, setShowStatus] = useState(false);
  const [statusIndex, setStatusIndex] = useState(0);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rotateRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shortDisplayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (delayRef.current) clearTimeout(delayRef.current);
      if (rotateRef.current) clearInterval(rotateRef.current);
      if (shortDisplayRef.current) clearTimeout(shortDisplayRef.current);
    };
  }, []);

  useEffect(() => {
    if (planLoading) {
      displayedRef.current = false;
      setStatusIndex(0);
      if (delayRef.current) clearTimeout(delayRef.current);
      if (rotateRef.current) clearInterval(rotateRef.current);
      if (shortDisplayRef.current) clearTimeout(shortDisplayRef.current);
      delayRef.current = setTimeout(() => {
        displayedRef.current = true;
        setShowStatus(true);
        rotateRef.current = setInterval(() => {
          setStatusIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
        }, 800);
      }, 1500);
    } else {
      if (delayRef.current) {
        clearTimeout(delayRef.current);
        delayRef.current = null;
      }
      if (rotateRef.current) {
        clearInterval(rotateRef.current);
        rotateRef.current = null;
      }
      if (!displayedRef.current) {
        setStatusIndex(0);
        setShowStatus(true);
        shortDisplayRef.current = setTimeout(() => {
          setShowStatus(false);
        }, 600);
      } else {
        setShowStatus(false);
      }
    }
  }, [planLoading, STATUS_MESSAGES.length]);

  const acceptDisabled = pending || userLoading || planLoading || !userId || !plan || !tasks.length || !!success;
  const combinedError = error || planError;
  const currentStatus = success?.status ?? resolutionStatus;
  const selectedSection = weekSections.find((section) => section.week === selectedWeek);
  const isEditableWeek = currentStatus === "draft" && selectedWeek === 1 && !success;
  const editableTasksOrdered = useMemo(() => sortTasksBySchedule(tasks), [tasks]);
  const readOnlyTasksOrdered = useMemo(
    () => sortTasksBySchedule(selectedSection?.tasks ?? []),
    [selectedSection],
  );
  const displayTasks = isEditableWeek ? editableTasksOrdered : readOnlyTasksOrdered;
  const focusForSelectedWeek = selectedSection?.focus ?? "";
  const selectedMilestone = useMemo(() => {
    if (!plan?.plan?.milestones) return null;
    return plan.plan.milestones.find(
      (milestone) =>
        milestone.week === selectedWeek ||
        // Support legacy week_number keys if present
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (milestone as any).week_number === selectedWeek,
    );
  }, [plan, selectedWeek]);
  const shouldShowTaskSection = isEditableWeek ? tasks.length > 0 : weekSections.length > 0;
  const showUpcomingBanner = !isEditableWeek && currentStatus === "draft";

  if ((planLoading || userLoading) && !plan) {
    return (
      <View style={styles.loadingState}>
        <View style={styles.loadingCard}>
          <ActivityIndicator color="#1D4ED8" size="large" />
          <Text style={styles.loadingTitle}>Cueing up a supportive outline…</Text>
          <Text style={styles.loadingHelper}>
            {showStatus ? STATUS_MESSAGES[statusIndex] : "Smoothing the path before we dive in."}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {plan ? (
            <View style={styles.header}>
              <Text style={styles.heroTitle}>Proposed Plan</Text>
              <Text style={styles.heroSubtitle}>Goal: {plan.title}</Text>
            </View>
          ) : null}

          {combinedError ? <Text style={styles.error}>{combinedError}</Text> : null}

          {plan ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitleSerif}>Vision</Text>
                <Text style={styles.sectionHelper}>{plan.plan.weeks} weeks</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeline}>
                {weekSections.map((section) => {
                  const active = section.week === selectedWeek;
                  return (
                    <TouchableOpacity
                      key={section.week}
                      style={[styles.weekPill, active && styles.weekPillActive]}
                      onPress={() => setSelectedWeek(section.week)}
                    >
                      <Text style={[styles.weekLabel, active && styles.weekLabelActive]}>W{section.week}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Text style={styles.focusLabel}>
                Focus: {focusForSelectedWeek || "Reinforce your routine"}
              </Text>
              {selectedMilestone?.success_criteria?.length ? (
                <View style={styles.goalCard}>
                  <Text style={styles.goalTitle}>Success signals</Text>
                  {selectedMilestone.success_criteria.map((criterion, idx) => (
                    <Text key={`${selectedMilestone.week}-${idx}`} style={styles.goalBullet}>
                      • {criterion}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {showStatus ? (
            <View style={styles.statusBanner}>
              <Text style={styles.statusLabel}>Crafting your weekly groove…</Text>
              <Text style={styles.statusMessage}>{STATUS_MESSAGES[statusIndex]}</Text>
            </View>
          ) : null}

          {shouldShowTaskSection ? (
            <View style={styles.taskSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitleSerif}>Week {selectedWeek} Tasks</Text>
                <Text style={styles.sectionHelper}>
                  {isEditableWeek ? "Editable" : "Preview"}
                </Text>
              </View>
              {showUpcomingBanner ? (
                <View style={styles.upcomingBanner}>
                  <Text style={styles.upcomingTitle}>Draft – upcoming week</Text>
                  <Text style={styles.upcomingCopy}>These tasks will unlock as you progress.</Text>
                </View>
              ) : null}
              {isEditableWeek
                ? (displayTasks as EditableTask[]).map((task) => (
                    <View key={task.id} style={styles.taskCard}>
                      <TextInput
                        style={styles.taskInput}
                        value={task.title}
                        onChangeText={(value) => updateTaskField(task.id, "title", value)}
                        placeholder="Describe the task..."
                        editable={!pending && !success}
                      />
                      <View style={styles.taskControls}>
                        <TouchableOpacity
                          style={styles.pillButton}
                          onPress={() => openDatePicker(task)}
                          disabled={pending || !!success}
                        >
                          <Text style={styles.pillText}>{task.scheduled_day || "Pick date"}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.pillButton}
                          onPress={() => openTimePicker(task)}
                          disabled={pending || !!success}
                        >
                          <Text style={styles.pillText}>{task.scheduled_time || "Pick time"}</Text>
                        </TouchableOpacity>
                        <TextInput
                          style={styles.durationInput}
                          placeholder="Minutes"
                          keyboardType="number-pad"
                          value={task.duration_min}
                          onChangeText={(value) => updateTaskField(task.id, "duration_min", value.replace(/[^0-9]/g, ""))}
                          editable={!pending && !success}
                        />
                    </View>
                    {task.original.note ? (
                      <Text style={styles.taskNoteHelper}>{task.original.note}</Text>
                    ) : null}
                  </View>
                ))
              : (displayTasks as WeekPlanTask[]).map((task) => {
                    const scheduleLabel = formatScheduleLabel(task.scheduled_day, task.scheduled_time);
                    return (
                    <View key={task.id} style={[styles.taskCard, styles.readOnlyCard]}>
                      <Text style={styles.readOnlyTitle}>{task.title}</Text>
                      {task.intent ? <Text style={styles.readOnlyIntent}>{task.intent}</Text> : null}
                      <View style={styles.readOnlyMeta}>
                        {task.cadence ? <Text style={styles.readOnlyChip}>{task.cadence}</Text> : null}
                        {task.duration_min ? <Text style={styles.readOnlyChip}>{task.duration_min} min</Text> : null}
                        {task.confidence ? <Text style={styles.readOnlyChip}>Confidence: {task.confidence}</Text> : null}
                      </View>
                      <Text style={styles.readOnlyTime}>Suggested: {scheduleLabel}</Text>
                      {task.note ? <Text style={styles.readOnlyNote}>{task.note}</Text> : null}
                    </View>
                  );
                  })}
              {isEditableWeek ? (
                <TouchableOpacity style={styles.addButton} onPress={addTask} disabled={pending || !!success}>
                  <Text style={styles.addButtonText}>+ Add another task</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {success ? (
            <View style={styles.successCard}>
              <Text style={styles.successTitle}>Plan Activated</Text>
              <Text style={styles.successSubtitle}>Week 1 tasks are now live in My Week.</Text>
              <TouchableOpacity style={styles.successButton} onPress={() => navigation.navigate("Home")}>
                <Text style={styles.successButtonText}>Back to Home</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>

        {!success ? (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.primaryButton, acceptDisabled && styles.primaryButtonDisabled]}
              onPress={handleAccept}
              disabled={acceptDisabled}
            >
              {pending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Start Resolution</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleRegenerate} disabled={pending} style={styles.secondaryLink}>
              <Text style={styles.secondaryButtonText}>Regenerate</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleReject} disabled={pending}>
              <Text style={styles.rejectText}>Reject Plan</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {pickerState ? (
        <Modal transparent animationType="fade">
          <View style={styles.pickerBackdrop}>
            <View style={styles.pickerCard}>
              <Text style={styles.sectionTitleSerif}>
                {pickerState.mode === "date" ? "Pick a date" : "Pick a time"}
              </Text>
              <DateTimePicker
                value={pickerState.value}
                mode={pickerState.mode}
                display="spinner"
                onChange={(_, date) => {
                  if (date) {
                    setPickerState((prev) => (prev ? { ...prev, value: date } : prev));
                  }
                }}
              />
              <View style={styles.pickerActions}>
                <TouchableOpacity style={styles.modalButton} onPress={closePicker}>
                  <Text style={styles.secondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.modalPrimary]} onPress={confirmPicker}>
                  <Text style={styles.buttonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FAFAF8",
  },
  container: {
    padding: 20,
    paddingBottom: 140,
    gap: 20,
  },
  header: {
    gap: 6,
  },
  heroTitle: {
    fontSize: 30,
    color: "#2D3748",
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
  },
  heroSubtitle: {
    color: "#6B7280",
    fontSize: 16,
    fontFamily: Platform.select({ ios: "System", default: "sans-serif" }),
  },
  error: {
    color: "#C53030",
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 12,
  },
  sectionTitleSerif: {
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 18,
    color: "#1F2933",
  },
  sectionHelper: {
    color: "#94A3B8",
    fontSize: 13,
    fontFamily: Platform.select({ ios: "System", default: "sans-serif" }),
  },
  timeline: {
    paddingVertical: 4,
    gap: 8,
  },
  weekPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
  },
  weekPillActive: {
    backgroundColor: "#6B8DBF",
  },
  weekLabel: {
    fontWeight: "600",
    color: "#475569",
  },
  weekLabelActive: {
    color: "#fff",
  },
  focusLabel: {
    marginTop: 14,
    marginBottom: 8,
    color: "#1F2933",
    fontWeight: "700",
    fontFamily: Platform.select({ ios: "System", default: "sans-serif" }),
  },
  goalCard: {
    backgroundColor: "#EEF2FF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#CBD5F5",
    gap: 6,
  },
  goalTitle: {
    fontWeight: "700",
    color: "#1D4ED8",
  },
  goalList: {
    marginTop: 4,
    gap: 4,
  },
  goalBullet: {
    color: "#1E3A8A",
    fontSize: 13,
  },
  taskSection: {
    gap: 12,
  },
  taskCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    gap: 12,
  },
  taskInput: {
    fontSize: 16,
    fontFamily: Platform.select({ ios: "System", default: "sans-serif" }),
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
    paddingBottom: 6,
  },
  taskControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pillButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
  },
  pillText: {
    color: "#475569",
    fontSize: 13,
  },
  durationInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  taskNoteHelper: {
    marginTop: 6,
    color: "#64748B",
    fontSize: 13,
  },
  addButton: {
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#CBD5F5",
    alignItems: "center",
  },
  addButtonText: {
    color: "#6B8DBF",
    fontWeight: "600",
  },
  readOnlyCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  readOnlyTitle: {
    fontWeight: "600",
    color: "#1F2937",
    fontSize: 16,
  },
  readOnlyIntent: {
    color: "#475569",
    marginTop: 6,
  },
  readOnlyMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  readOnlyChip: {
    backgroundColor: "#F1F5F9",
    color: "#475569",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
  },
  readOnlyTime: {
    marginTop: 12,
    color: "#64748B",
    fontSize: 13,
  },
  readOnlyNote: {
    marginTop: 8,
    color: "#475569",
    fontStyle: "italic",
  },
  upcomingBanner: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#F0F4FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    marginBottom: 12,
  },
  upcomingTitle: {
    fontWeight: "600",
    color: "#4338CA",
    marginBottom: 4,
  },
  upcomingCopy: {
    color: "#414B5A",
  },
  statusBanner: {
    backgroundColor: "#EFF6FF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    gap: 4,
    marginTop: 16,
  },
  statusLabel: {
    fontSize: 12,
    letterSpacing: 0.5,
    color: "#1D4ED8",
    fontFamily: Platform.select({ ios: "System", default: "sans-serif" }),
  },
  statusMessage: {
    fontSize: 16,
    color: "#1E293B",
    fontFamily: Platform.select({ ios: "System", default: "sans-serif-medium" }),
  },
  successCard: {
    backgroundColor: "#9DB8A0",
    borderRadius: 20,
    padding: 20,
    gap: 8,
  },
  successTitle: {
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    fontSize: 20,
    color: "#0F172A",
  },
  successSubtitle: {
    color: "#0F172A",
    fontFamily: Platform.select({ ios: "System", default: "sans-serif" }),
  },
  successButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#1F2933",
    alignItems: "center",
  },
  successButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 32 : 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FAFAF8",
    gap: 8,
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
    backgroundColor: "#6B8DBF",
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryLink: {
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#6B8DBF",
    fontWeight: "600",
  },
  rejectText: {
    color: "#94A3B8",
    textAlign: "center",
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24,
  },
  pickerCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
  },
  pickerActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalPrimary: {
    backgroundColor: "#6B8DBF",
    borderRadius: 10,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  secondaryText: {
    color: "#6B8DBF",
    fontWeight: "600",
  },
  helper: {
    marginTop: 8,
    color: "#666",
  },
  loadingState: {
    flex: 1,
    backgroundColor: "#FAFAF8",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingCard: {
    width: "85%",
    borderRadius: 24,
    padding: 24,
    backgroundColor: "#ffffff",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    alignItems: "center",
    gap: 12,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1E293B",
    textAlign: "center",
  },
  loadingHelper: {
    textAlign: "center",
    color: "#475569",
  },
});

function parseDate(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function parseTime(value: string): Date | null {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (hours == null || minutes == null || Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

const pad = (num: number) => num.toString().padStart(2, "0");

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
}

function formatTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
