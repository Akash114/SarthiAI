import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Calendar as CalendarIcon, Check, Bell, Trash2 } from "lucide-react-native";
import { formatScheduleLabel } from "../utils/datetime";
import { hasCalendarPermissions, isTaskSynced, requestCalendarPermissions, syncTaskToCalendar } from "../hooks/useCalendarSync";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { useNotifications } from "../hooks/useNotifications";
import { useUserId } from "../state/user";
import { useTheme } from "../theme";

export type TaskCardTask = {
  id: string;
  title: string;
  completed: boolean;
  scheduled_day: string | null;
  scheduled_time: string | null;
  duration_min: number | null;
};

type Props = {
  task: TaskCardTask;
  onToggle?: (taskId: string, completed: boolean) => void;
  onPress?: () => void;
  badgeLabel?: string | null;
  footer?: ReactNode;
  disabled?: boolean;
  onDelete?: (taskId: string) => void;
  deleteDisabled?: boolean;
};

export function TaskCard({
  task,
  onToggle,
  onPress,
  badgeLabel,
  footer,
  disabled,
  onDelete,
  deleteDisabled,
}: Props) {
  const [syncing, setSyncing] = useState(false);
  const [alreadySynced, setAlreadySynced] = useState(false);
  const [reminderScheduled, setReminderScheduled] = useState(false);
  const { registerForPushNotificationsAsync, scheduleTaskReminder } = useNotifications();
  const { userId } = useUserId();
  const { theme } = useTheme();

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      if (!task.scheduled_day) {
        if (mounted) setAlreadySynced(false);
        return;
      }
      try {
        const permitted = await hasCalendarPermissions();
        if (!permitted) {
          if (mounted) setAlreadySynced(false);
          return;
        }
        const synced = await isTaskSynced({
          title: task.title,
          scheduled_day: task.scheduled_day,
          scheduled_time: task.scheduled_time,
          duration_min: task.duration_min,
        });
        if (mounted) {
          setAlreadySynced(synced);
        }
      } catch {
        if (mounted) setAlreadySynced(false);
      } finally {
        // intentionally empty - no UI change needed
      }
    };
    check();
    return () => {
      mounted = false;
    };
  }, [task.id, task.scheduled_day, task.scheduled_time, task.duration_min, task.title]);

  useEffect(() => {
    setReminderScheduled(false);
  }, [task.id, task.scheduled_day, task.scheduled_time]);

  const handleToggle = useCallback(() => {
    if (disabled || !onToggle) return;
    onToggle(task.id, !task.completed);
  }, [disabled, onToggle, task]);

  const handleSync = useCallback(async () => {
    if (syncing) return;
    if (!task.scheduled_day) {
      Alert.alert("Schedule missing", "Add a scheduled day before syncing to calendar.");
      return;
    }
    setSyncing(true);
    try {
      const granted = await requestCalendarPermissions();
      if (!granted) {
        Alert.alert("Permission needed", "Calendar or reminders access was not granted.");
        return;
      }
      await syncTaskToCalendar({
        title: task.title,
        scheduled_day: task.scheduled_day,
        scheduled_time: task.scheduled_time,
        duration_min: task.duration_min,
      });
      setAlreadySynced(true);
      Alert.alert("Synced", "Task added to your calendar.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sync task right now.";
      Alert.alert("Calendar error", message);
    } finally {
      setSyncing(false);
    }
  }, [task, syncing]);

  const handleReminder = useCallback(async () => {
    if (!task.scheduled_day || !task.scheduled_time) {
      Alert.alert("Schedule missing", "Add a scheduled day and time before setting a reminder.");
      return;
    }
    try {
      const granted = await registerForPushNotificationsAsync(userId);
      if (!granted) {
        Alert.alert("Permission needed", "Enable push notifications in Settings to get reminders.");
        return;
      }
      const notificationId = await scheduleTaskReminder({
        title: task.title,
        scheduled_day: task.scheduled_day,
        scheduled_time: task.scheduled_time,
      });
      if (!notificationId) {
        Alert.alert("Too late", "This task's time has already passed.");
        return;
      }
      setReminderScheduled(true);
      Alert.alert("Reminder set", "We'll notify you right on time.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to schedule reminder.";
      Alert.alert("Reminders", message);
    }
  }, [task, registerForPushNotificationsAsync, scheduleTaskReminder]);

  const scheduleLabel = formatScheduleLabel(task.scheduled_day, task.scheduled_time);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          shadowColor: theme.shadow,
        },
        task.completed && styles.cardCompleted,
      ]}
    >
      <View style={styles.row}>
        <TouchableOpacity
          style={[
            styles.checkbox,
            {
              borderColor: task.completed ? theme.accent : theme.border,
              backgroundColor: task.completed ? theme.accent : "transparent",
            },
          ]}
          onPress={handleToggle}
          disabled={!onToggle}
        >
          {task.completed ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
        </TouchableOpacity>
        <TouchableOpacity style={styles.body} onPress={onPress} activeOpacity={onPress ? 0.8 : 1}>
          <Text
            style={[
              styles.title,
              { color: theme.textPrimary },
              task.completed && { color: theme.textMuted, textDecorationLine: "line-through" },
            ]}
          >
            {task.title}
          </Text>
          <Text style={[styles.metaText, { color: theme.textSecondary }]}>{scheduleLabel || "Unscheduled"}</Text>
          {badgeLabel ? (
            <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
              <Text style={[styles.badgeText, { color: theme.accentText }]}>{badgeLabel}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
        {(!task.completed || onDelete) ? (
          <View style={styles.actions}>
            {!task.completed && !alreadySynced ? (
              <TouchableOpacity
                style={[
                  styles.syncButton,
                  { borderColor: theme.accent, backgroundColor: theme.accentSoft },
                ]}
                onPress={handleSync}
                disabled={syncing}
              >
                <CalendarIcon size={20} color={theme.accent} />
              </TouchableOpacity>
            ) : null}
            {!task.completed && !reminderScheduled ? (
              <TouchableOpacity
                style={[
                  styles.reminderButton,
                  { borderColor: theme.warning, backgroundColor: theme.accentSoft },
                ]}
                onPress={handleReminder}
              >
                <Bell size={18} color={theme.warning} />
              </TouchableOpacity>
            ) : null}
            {onDelete ? (
              <TouchableOpacity
                style={[
                  styles.deleteButton,
                  { borderColor: theme.danger, backgroundColor: theme.accentSoft },
                ]}
                onPress={() => onDelete(task.id)}
                disabled={deleteDisabled}
              >
                <Trash2 size={18} color={theme.danger} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 16,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    marginBottom: 12,
    borderWidth: 1,
  },
  cardCompleted: {
    opacity: 0.7,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  body: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
  },
  metaText: {
    marginTop: 4,
  },
  badge: {
    marginTop: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontWeight: "600",
    fontSize: 12,
  },
  syncButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  reminderButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
  footer: {
    marginTop: 10,
  },
});
