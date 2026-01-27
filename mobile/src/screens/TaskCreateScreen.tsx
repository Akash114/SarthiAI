import { useState } from "react";
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import type { RootStackParamList } from "../../types/navigation";
import { createTask } from "../api/tasks";
import { useUserId } from "../state/user";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { TimeSlotModal } from "../components/TimeSlotModal";
import { useTaskSchedule } from "../hooks/useTaskSchedule";

type Props = NativeStackScreenProps<RootStackParamList, "TaskCreate">;

export default function TaskCreateScreen() {
  const navigation = useNavigation<Props["navigation"]>();
  const { userId } = useUserId();

  const [title, setTitle] = useState("");
  const [scheduledDay, setScheduledDay] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [duration, setDuration] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerState, setPickerState] = useState<{ value: Date } | null>(null);
  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const [timeOptions, setTimeOptions] = useState<string[]>([]);

  const { getAvailableTimes } = useTaskSchedule(userId);

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

  const openPicker = () => {
    const value = parseDate(scheduledDay) ?? new Date();
    setPickerState({ value });
  };

  const closePicker = () => setPickerState(null);

  const handlePickerChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (!selectedDate) return;
    setPickerState((prev) => (prev ? { ...prev, value: selectedDate } : prev));
  };

  const confirmPicker = () => {
    if (!pickerState) return;
    setScheduledDay(formatDate(pickerState.value));
    closePicker();
  };

  const openTimeSelector = () => {
    if (!scheduledDay) {
      Alert.alert("Pick a date", "Please choose a day before picking a time.");
      return;
    }
    const options = getAvailableTimes(scheduledDay, { currentTime: scheduledTime || null });
    if (!options.length) {
      Alert.alert("No slots", "All standard slots are full for this day. Choose another date.");
      return;
    }
    setTimeOptions(options);
    setTimeModalVisible(true);
  };

  return (
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
      />

      <Text style={styles.label}>Scheduled Day (optional)</Text>
      <TouchableOpacity style={styles.input} onPress={openPicker}>
        <Text style={scheduledDay ? styles.pickerValue : styles.placeholder}>
          {scheduledDay ? scheduledDay : "Pick a date"}
        </Text>
      </TouchableOpacity>

      <Text style={styles.label}>Scheduled Time (optional)</Text>
      <TouchableOpacity style={styles.input} onPress={openTimeSelector}>
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
        keyboardType="numeric"
      />

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.noteInput]}
        value={note}
        onChangeText={setNote}
        placeholder="Add context or prep details…"
        multiline
      />

      <TouchableOpacity style={[styles.button, saving && styles.buttonDisabled]} onPress={handleCreate} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Task</Text>}
      </TouchableOpacity>
      {pickerState ? (
        <Modal transparent animationType="fade" visible={true}>
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerCard}>
              <DateTimePicker value={pickerState.value} mode="date" display="spinner" onChange={handlePickerChange} />
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
      <TimeSlotModal
        visible={timeModalVisible}
        day={scheduledDay}
        options={timeOptions}
        onClose={() => setTimeModalVisible(false)}
        onSelect={(slot) => {
          setScheduledTime(slot);
          setTimeModalVisible(false);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
  },
  subtitle: {
    color: "#4b5563",
    marginBottom: 8,
  },
  label: {
    fontWeight: "600",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d0d5dd",
    borderRadius: 12,
    padding: 12,
  },
  placeholder: {
    color: "#9CA3AF",
  },
  pickerValue: {
    color: "#111827",
  },
  noteInput: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  button: {
    marginTop: 16,
    backgroundColor: "#1a73e8",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#8fb5f8",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  error: {
    color: "#c62828",
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  pickerCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
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
  },
  pickerConfirm: {
    backgroundColor: "#e8f0fe",
    borderRadius: 10,
    marginLeft: 8,
  },
  pickerConfirmText: {
    color: "#1a73e8",
  },
});

function parseDate(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

const pad = (num: number) => num.toString().padStart(2, "0");

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
