import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RootStackParamList } from "../../types/navigation";
import { getTask, updateTask } from "../api/tasks";
import { useUserId } from "../state/user";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { TimeSlotModal } from "../components/TimeSlotModal";
import { useTaskSchedule } from "../hooks/useTaskSchedule";

type Props = NativeStackScreenProps<RootStackParamList, "TaskEdit">;

export default function TaskEditScreen() {
  const navigation = useNavigation<Props["navigation"]>();
  const route = useRoute<Props["route"]>();
  const { taskId } = route.params;
  const { userId } = useUserId();

  const [title, setTitle] = useState("");
  const [completed, setCompleted] = useState(false);
  const [scheduledDay, setScheduledDay] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerState, setPickerState] = useState<{ value: Date } | null>(null);
  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const [timeOptions, setTimeOptions] = useState<string[]>([]);

  const { getAvailableTimes } = useTaskSchedule(userId);

  useEffect(() => {
    const loadTask = async () => {
      if (!userId) return;
      setLoading(true);
      setError(null);
      try {
        const task = await getTask(taskId, userId);
        setTitle(task.title);
        setCompleted(task.completed);
        setScheduledDay(task.scheduled_day || "");
        setScheduledTime(task.scheduled_time || "");
        setNote(task.note || "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load task.");
      } finally {
        setLoading(false);
      }
    };
    loadTask();
  }, [taskId, userId]);

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    setError(null);
    try {
      await updateTask(taskId, userId, {
        title,
        completed,
        scheduled_day: scheduledDay || null,
        scheduled_time: scheduledTime || null,
        note,
      });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update task.");
    } finally {
      setSaving(false);
    }
  };

  const openPicker = () => {
    const value = parseDate(scheduledDay) ?? new Date();
    setPickerState({ value });
  };

  const handlePickerChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (!selectedDate) return;
    setPickerState((prev) => (prev ? { ...prev, value: selectedDate } : prev));
  };

  const confirmPicker = () => {
    if (!pickerState) return;
    setScheduledDay(formatDate(pickerState.value));
    setPickerState(null);
  };

  const openTimeSelector = () => {
    if (!scheduledDay) {
      Alert.alert("Pick a date", "Please select a day before choosing a time.");
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.helper}>Loading task…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Edit Task</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.label}>Title</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        style={styles.input}
        placeholder="Task title"
      />

      <View style={styles.row}>
        <Text style={styles.label}>Completed</Text>
        <Switch value={completed} onValueChange={setCompleted} />
      </View>

      <Text style={styles.label}>Scheduled Day</Text>
      <TouchableOpacity style={styles.input} onPress={openPicker}>
        <Text style={scheduledDay ? styles.valueText : styles.placeholderText}>
          {scheduledDay || "Pick a date"}
        </Text>
      </TouchableOpacity>

      <Text style={styles.label}>Scheduled Time</Text>
      <TouchableOpacity style={styles.input} onPress={openTimeSelector}>
        <Text style={scheduledTime ? styles.valueText : styles.placeholderText}>
          {scheduledTime || "Pick a time"}
        </Text>
      </TouchableOpacity>

      <Text style={styles.label}>Notes</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        style={[styles.input, styles.noteInput]}
        placeholder="Add a note..."
        multiline
      />

      <TouchableOpacity style={[styles.button, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save Changes</Text>}
      </TouchableOpacity>
      {pickerState ? (
        <Modal transparent animationType="fade" visible={true}>
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerCard}>
              <DateTimePicker value={pickerState.value} mode="date" display="spinner" onChange={handlePickerChange} />
              <View style={styles.pickerActions}>
                <TouchableOpacity style={styles.pickerButton} onPress={() => setPickerState(null)}>
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
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
  placeholderText: {
    color: "#9CA3AF",
  },
  valueText: {
    color: "#111827",
  },
  noteInput: {
    minHeight: 120,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  helper: {
    marginTop: 8,
    color: "#666",
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
