import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import type { RootStackParamList } from "../../types/navigation";
import { createTask } from "../api/tasks";
import { useUserId } from "../state/user";
import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useTaskSchedule } from "../hooks/useTaskSchedule";
import { useTheme } from "../theme";
import type { ThemeTokens } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "TaskCreate">;

export default function TaskCreateScreen() {
  const navigation = useNavigation<Props["navigation"]>();
  const { userId } = useUserId();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [title, setTitle] = useState("");
  const [scheduledDay, setScheduledDay] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [duration, setDuration] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerState, setPickerState] = useState<{ mode: "date" | "time"; value: Date } | null>(null);

  const { isSlotTaken } = useTaskSchedule(userId);

  const handleCreate = async () => {
    if (!userId || !title.trim()) {
      setError("Please enter a title.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createTask({
        user_id: userId,
        title: title.trim(),
        scheduled_day: scheduledDay ? scheduledDay : undefined,
        scheduled_time: scheduledTime ? scheduledTime : undefined,
        duration_min: duration ? Number(duration) : undefined,
        note,
      });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create task.");
    } finally {
      setSaving(false);
    }
  };

  const applySelection = (mode: "date" | "time", selectedDate: Date) => {
    if (mode === "date") {
      const formatted = formatDate(selectedDate);
      if (scheduledTime && isSlotTaken(formatted, scheduledTime)) {
        Alert.alert("Slot taken", "Another task already uses that day/time.");
        return false;
      }
      setScheduledDay(formatted);
    } else {
      if (!scheduledDay) {
        Alert.alert("Pick a date", "Choose a day before selecting a time.");
        return false;
      }
      const formatted = formatTime(selectedDate);
      if (isSlotTaken(scheduledDay, formatted)) {
        Alert.alert("Slot taken", "Another task already uses that time.");
        return false;
      }
      setScheduledTime(formatted);
    }
    return true;
  };

  const openPickerWebFallback = (mode: "date" | "time") => {
    const promptFn = (globalThis as { prompt?: (message?: string, defaultText?: string) => string | null }).prompt;
    if (!promptFn) {
      Alert.alert("Not supported", "Pick date and time on iOS or Android in the native app.");
      return;
    }
    if (mode === "date") {
      const raw = promptFn("Date (YYYY-MM-DD)", scheduledDay || "");
      if (raw == null) return;
      const trimmed = raw.trim();
      if (!trimmed) return;
      const parsed = parseDate(trimmed);
      if (!parsed) {
        Alert.alert("Invalid date", "Use YYYY-MM-DD.");
        return;
      }
      applySelection("date", parsed);
      return;
    }
    if (!scheduledDay) {
      Alert.alert("Pick a date", "Choose a day before selecting a time.");
      return;
    }
    const raw = promptFn("Time (24h HH:MM)", scheduledTime || "");
    if (raw == null) return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    const normalized = /^\d{1,2}:\d{1,2}$/.test(trimmed)
      ? `${trimmed.split(":")[0]!.padStart(2, "0")}:${trimmed.split(":")[1]!.padStart(2, "0")}`
      : trimmed;
    const parsed = parseTime(normalized);
    if (!parsed) {
      Alert.alert("Invalid time", "Use HH:MM (24 hour).");
      return;
    }
    applySelection("time", parsed);
  };

  const openPicker = (mode: "date" | "time") => {
    const value =
      mode === "date" ? parseDate(scheduledDay) ?? new Date() : parseTime(scheduledTime) ?? new Date();

    if (Platform.OS === "android") {
      if (mode === "time" && !scheduledDay) {
        Alert.alert("Pick a date", "Choose a day before selecting a time.");
        return;
      }
      DateTimePickerAndroid.open({
        mode,
        value,
        is24Hour: true,
        onChange: (_event, selectedDate) => {
          if (selectedDate) {
            applySelection(mode, selectedDate);
          }
        },
      });
      return;
    }

    if (Platform.OS === "web") {
      openPickerWebFallback(mode);
      return;
    }

    if (Platform.OS === "ios") {
      setPickerState({ mode, value });
    }
  };

  const closePicker = () => setPickerState(null);

  const handlePickerChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (!selectedDate) return;
    setPickerState((prev) => (prev ? { ...prev, value: selectedDate } : prev));
  };

  const confirmPicker = () => {
    if (!pickerState) return;
    const success = applySelection(pickerState.mode, pickerState.value);
    if (success) {
      closePicker();
    }
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>New Task</Text>
        <Text style={styles.subtitle}>Create a quick standalone task for this week.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g., Review project brief"
          placeholderTextColor={theme.textMuted}
        />

        <Text style={styles.label}>Scheduled Day (optional)</Text>
        <TouchableOpacity style={styles.input} onPress={() => openPicker("date")}>
          <Text style={scheduledDay ? styles.pickerValue : styles.placeholder}>
            {scheduledDay ? scheduledDay : "Pick a date"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.label}>Scheduled Time (optional)</Text>
        <TouchableOpacity style={styles.input} onPress={() => openPicker("time")}>
          <Text style={scheduledTime ? styles.pickerValue : styles.placeholder}>
            {scheduledTime ? scheduledTime : "Pick a time"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.label}>Duration (minutes)</Text>
        <TextInput
          style={styles.input}
          value={duration}
          onChangeText={setDuration}
          placeholder="30"
          placeholderTextColor={theme.textMuted}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.noteInput]}
          value={note}
          onChangeText={setNote}
          placeholder="Add context or prep details…"
          placeholderTextColor={theme.textMuted}
          multiline
        />

        <TouchableOpacity style={[styles.button, saving && styles.buttonDisabled]} onPress={handleCreate} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={theme.mode === "dark" ? theme.textPrimary : "#fff"} />
          ) : (
            <Text style={styles.buttonText}>Create Task</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      {pickerState && Platform.OS === "ios" ? (
        <Modal transparent animationType="fade" visible onRequestClose={closePicker}>
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerCard}>
              <View style={styles.pickerWheelShell}>
                <DateTimePicker
                  value={pickerState.value}
                  mode={pickerState.mode}
                  display="spinner"
                  themeVariant={theme.mode === "dark" ? "dark" : "light"}
                  textColor={theme.textPrimary}
                  style={styles.pickerIOSNative}
                  onChange={handlePickerChange}
                />
              </View>
              <View style={styles.pickerActions}>
                <TouchableOpacity style={styles.pickerButton} onPress={closePicker}>
                  <Text style={styles.pickerButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.pickerButton, styles.pickerConfirm]} onPress={confirmPicker}>
                  <Text style={[styles.pickerButtonText, styles.pickerConfirmText]}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const createStyles = (theme: ThemeTokens) => {
  const accentForeground = theme.mode === "dark" ? theme.textPrimary : "#fff";

  return StyleSheet.create({
    container: {
      padding: 20,
      gap: 12,
      backgroundColor: theme.background,
    },
    title: {
      fontSize: 24,
      fontWeight: "600",
      color: theme.textPrimary,
    },
    subtitle: {
      color: theme.textSecondary,
      marginBottom: 8,
    },
    label: {
      fontWeight: "600",
      marginBottom: 4,
      color: theme.textSecondary,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 12,
      backgroundColor: theme.card,
      color: theme.textPrimary,
    },
    placeholder: {
      color: theme.textMuted,
    },
    pickerValue: {
      color: theme.textPrimary,
    },
    noteInput: {
      minHeight: 120,
      textAlignVertical: "top",
    },
    button: {
      marginTop: 16,
      backgroundColor: theme.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    buttonDisabled: {
      backgroundColor: theme.accentSoft,
    },
    buttonText: {
      color: accentForeground,
      fontWeight: "600",
    },
    error: {
      color: theme.danger,
    },
    pickerOverlay: {
      flex: 1,
      backgroundColor: theme.overlay,
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
    },
    pickerCard: {
      width: "100%",
      maxWidth: 400,
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    pickerWheelShell: {
      width: "100%",
      height: 216,
      overflow: "hidden",
    },
    pickerIOSNative: {
      width: "100%",
      height: 216,
    },
    pickerActions: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 8,
    },
    pickerButton: {
      flex: 1,
      paddingVertical: 12,
      alignItems: "center",
    },
    pickerButtonText: {
      fontWeight: "600",
      color: theme.textPrimary,
    },
    pickerConfirm: {
      backgroundColor: theme.accentSoft,
      borderRadius: 10,
      marginLeft: 8,
    },
    pickerConfirmText: {
      color: theme.accent,
      fontWeight: "600",
    },
  });
};

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
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
