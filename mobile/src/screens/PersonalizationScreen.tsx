import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Clock, ChevronLeft } from "lucide-react-native";
import { getPreferences, updatePreferences, AvailabilityProfile } from "../api/preferences";
import { useUserId } from "../state/user";
import type { RootStackParamList } from "../../types/navigation";
import { useTheme } from "../theme";
import type { ThemeTokens } from "../theme";

const WEEKDAY_OPTIONS: { label: string; value: string }[] = [
  { label: "Mon", value: "Mon" },
  { label: "Tue", value: "Tue" },
  { label: "Wed", value: "Wed" },
  { label: "Thu", value: "Thu" },
  { label: "Fri", value: "Fri" },
  { label: "Sat", value: "Sat" },
  { label: "Sun", value: "Sun" },
];

const DEFAULT_PERSONAL_SLOTS = {
  fitness: "morning",
  learning: "evening",
  admin: "weekend",
} as const;

const SLOT_OPTIONS = ["morning", "afternoon", "evening"] as const;
const ADMIN_OPTIONS = ["weekend", "evenings"] as const;

type PersonalizationNav = NativeStackNavigationProp<RootStackParamList, "Personalization">;

type TimePickerState = {
  field: "start" | "end";
};

type Styles = ReturnType<typeof createStyles>;

const DEFAULT_PROFILE: AvailabilityProfile = {
  work_days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  work_start: "09:00",
  work_end: "18:00",
  peak_energy: "morning",
  work_mode_enabled: false,
  personal_slots: DEFAULT_PERSONAL_SLOTS,
};

export default function PersonalizationScreen() {
  const navigation = useNavigation<PersonalizationNav>();
  const { userId, loading: userLoading } = useUserId();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [profile, setProfile] = useState<AvailabilityProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timePicker, setTimePicker] = useState<TimePickerState | null>(null);
  const [tempTime, setTempTime] = useState<Date | null>(null);
  const resolvedSlots = useMemo(() => {
    const defaults = DEFAULT_PROFILE.personal_slots ?? DEFAULT_PERSONAL_SLOTS;
    return {
      fitness: profile.personal_slots?.fitness ?? defaults.fitness,
      learning: profile.personal_slots?.learning ?? defaults.learning,
      admin: profile.personal_slots?.admin ?? defaults.admin,
    };
  }, [profile.personal_slots]);

  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await getPreferences(userId);
      const normalizedProfile: AvailabilityProfile = {
        ...DEFAULT_PROFILE,
        ...data.availability_profile,
        personal_slots: {
          ...DEFAULT_PROFILE.personal_slots,
          ...(data.availability_profile.personal_slots ?? {}),
        },
      };
      setProfile(normalizedProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load personalization.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userLoading && userId) {
      fetchProfile();
    }
  }, [fetchProfile, userId, userLoading]);

  const toggleDay = (value: string) => {
    setProfile((prev) => {
      const hasDay = prev.work_days.includes(value);
      const work_days = hasDay ? prev.work_days.filter((day) => day !== value) : [...prev.work_days, value];
      return { ...prev, work_days };
    });
  };

  const openTimePicker = (field: "start" | "end") => {
    setTimePicker({ field });
    setTempTime(parseTimeToDate(field === "start" ? profile.work_start : profile.work_end));
  };

  const commitTimeValue = (field: "start" | "end", selectedDate: Date) => {
    const hours = selectedDate.getHours();
    const minutes = selectedDate.getMinutes();
    const value = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    setProfile((prev) => ({
      ...prev,
      work_start: field === "start" ? value : prev.work_start,
      work_end: field === "end" ? value : prev.work_end,
    }));
  };

  const handleTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (!timePicker) return;
    if (Platform.OS === "android") {
      if (event.type === "set" && selectedDate) {
        commitTimeValue(timePicker.field, selectedDate);
      }
      setTimePicker(null);
      return;
    }
    setTempTime(selectedDate || tempTime || parseTimeToDate(profile.work_start));
  };

  const closePicker = () => {
    setTimePicker(null);
    setTempTime(null);
  };

  const confirmIOSPicker = () => {
    if (timePicker && tempTime) {
      commitTimeValue(timePicker.field, tempTime);
    }
    closePicker();
  };

  const updatePersonalSlot = <K extends keyof NonNullable<AvailabilityProfile["personal_slots"]>>(
    key: K,
    value: NonNullable<AvailabilityProfile["personal_slots"]>[K],
  ) => {
    const defaults = DEFAULT_PROFILE.personal_slots ?? DEFAULT_PERSONAL_SLOTS;
    setProfile((prev) => ({
      ...prev,
      personal_slots: {
        fitness: prev.personal_slots?.fitness ?? defaults.fitness,
        learning: prev.personal_slots?.learning ?? defaults.learning,
        admin: prev.personal_slots?.admin ?? defaults.admin,
        [key]: value,
      },
    }));
  };

  const toggleWorkMode = (value: boolean) => {
    setProfile((prev) => ({ ...prev, work_mode_enabled: value }));
  };

  const onSave = async () => {
    if (!userId) return;
    if (!profile.work_days.length) {
      Alert.alert("Pick at least one day", "Select the days you usually work before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updatePreferences(userId, { availability_profile: profile });
      Alert.alert("Saved", "Your rhythm has been updated.");
      navigation.goBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to update your rhythm right now.";
      setError(message);
      Alert.alert("Update failed", message);
    } finally {
      setSaving(false);
    }
  };

  if (userLoading || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.accent} />
        <Text style={styles.helper}>Loading your rhythm…</Text>
      </View>
    );
  }

  const pickerValue = (() => {
    if (!timePicker) return undefined;
    if (tempTime) return tempTime;
    return parseTimeToDate(timePicker.field === "start" ? profile.work_start : profile.work_end);
  })();

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
          <ChevronLeft color={theme.textSecondary} size={18} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Design Your Ideal Day</Text>
        <Text style={styles.subtitle}>Tell Sarathi when you&apos;re on the clock and when you recharge.</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>The Work Block 💼</Text>
          <Text style={styles.sectionDescription}>When are you “On the Clock”?</Text>

          <Text style={[styles.sectionLabel, styles.spacingTop]}>Work hours</Text>
          <View style={styles.timeRow}>
            <TimeField
              label="Start"
              value={profile.work_start}
              onPress={() => openTimePicker("start")}
              theme={theme}
              styles={styles}
            />
            <TimeField
              label="End"
              value={profile.work_end}
              onPress={() => openTimePicker("end")}
              theme={theme}
              styles={styles}
            />
          </View>

          <Text style={[styles.sectionLabel, styles.spacingTop]}>Work days</Text>
          <View style={styles.pillRow}>
            {WEEKDAY_OPTIONS.map((option) => {
              const active = profile.work_days.includes(option.value);
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => toggleDay(option.value)}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Personal Slots 🧘</Text>
          <Text style={styles.sectionDescription}>When do you prefer to handle these activities?</Text>

          <Text style={[styles.sectionLabel, styles.spacingTop]}>Fitness</Text>
          <SegmentedControl
            options={SLOT_OPTIONS}
            value={resolvedSlots.fitness}
            onSelect={(value) => updatePersonalSlot("fitness", value)}
            theme={theme}
            styles={styles}
          />

          <Text style={[styles.sectionLabel, styles.spacingTop]}>Learning / Hobby</Text>
          <SegmentedControl
            options={SLOT_OPTIONS}
            value={resolvedSlots.learning}
            onSelect={(value) => updatePersonalSlot("learning", value)}
            theme={theme}
            styles={styles}
          />

          <Text style={[styles.sectionLabel, styles.spacingTop]}>Admin / Chores</Text>
          <SegmentedControl
            options={ADMIN_OPTIONS}
            value={resolvedSlots.admin}
            onSelect={(value) => updatePersonalSlot("admin", value)}
            theme={theme}
            styles={styles}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Context Rules</Text>
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.sectionLabel}>Strict Work Mode?</Text>
              <Text style={styles.helper}>
                If enabled, Sarathi hides personal tasks during work hours and work tasks during personal time.
              </Text>
            </View>
            <Switch
              value={profile.work_mode_enabled}
              onValueChange={toggleWorkMode}
              thumbColor={profile.work_mode_enabled ? theme.accent : theme.surfaceMuted}
              trackColor={{ true: theme.accent, false: theme.border }}
            />
          </View>
        </View>

        {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

        <TouchableOpacity style={[styles.saveButton, saving && styles.buttonDisabled]} onPress={onSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save Preferences</Text>}
        </TouchableOpacity>
      </ScrollView>

      {timePicker && pickerValue && Platform.OS === "android" ? (
        <DateTimePicker
          testID="work-time-picker"
          value={pickerValue}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      ) : null}

      {timePicker && pickerValue && Platform.OS === "ios" ? (
        <Modal transparent animationType="fade" visible onRequestClose={closePicker}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Select {timePicker.field} time</Text>
              <DateTimePicker value={pickerValue} mode="time" display="spinner" onChange={handleTimeChange} />
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalButton, styles.modalGhost]} onPress={closePicker}>
                  <Text style={[styles.modalButtonText, { color: theme.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.modalPrimary]} onPress={confirmIOSPicker}>
                  <Text style={[styles.modalButtonText, { color: "#fff" }]}>Set Time</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

type TimeFieldProps = {
  label: string;
  value: string;
  onPress: () => void;
  theme: ThemeTokens;
  styles: Styles;
};

function TimeField({ label, value, onPress, theme, styles }: TimeFieldProps) {
  return (
    <TouchableOpacity style={[styles.timeField, { borderColor: theme.border }]} onPress={onPress}>
      <Clock size={16} color={theme.textSecondary} />
      <View>
        <Text style={styles.timeFieldLabel}>{label}</Text>
        <Text style={styles.timeFieldValue}>{humanizeTime(value)}</Text>
      </View>
    </TouchableOpacity>
  );
}

type SegmentedProps = {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onPress: () => void;
  theme: ThemeTokens;
  styles: Styles;
};

type SegmentedControlProps<T extends readonly string[]> = {
  options: T;
  value: T[number];
  onSelect: (value: T[number]) => void;
  theme: ThemeTokens;
  styles: Styles;
};

function SegmentedControl<T extends readonly string[]>({ options, value, onSelect, theme, styles }: SegmentedControlProps<T>) {
  return (
    <View style={styles.segmentRow}>
      {options.map((option) => {
        const active = option === value;
        return (
          <TouchableOpacity
            key={option}
            style={[
              styles.segment,
              {
                borderColor: active ? theme.accent : theme.border,
                backgroundColor: active ? theme.accent : theme.surface,
              },
            ]}
            onPress={() => onSelect(option)}
          >
            <Text style={[styles.segmentText, { color: active ? "#fff" : theme.textPrimary }]}>
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function humanizeTime(value: string): string {
  const [hourStr, minuteStr] = value.split(":");
  const hours = Number(hourStr);
  const minutes = Number(minuteStr);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return value;
  }
  const date = new Date();
  date.setHours(hours);
  date.setMinutes(minutes);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function parseTimeToDate(value: string): Date {
  const [hourStr, minuteStr] = value.split(":");
  const hours = Number(hourStr);
  const minutes = Number(minuteStr);
  const base = new Date();
  base.setSeconds(0);
  base.setMilliseconds(0);
  base.setHours(Number.isFinite(hours) ? hours : 9);
  base.setMinutes(Number.isFinite(minutes) ? minutes : 0);
  return base;
}

const createStyles = (theme: ThemeTokens) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.background,
    },
    container: {
      padding: 20,
      gap: 16,
      paddingBottom: 40,
    },
    backRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    backText: {
      color: theme.textSecondary,
      fontWeight: "600",
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: theme.textPrimary,
    },
    subtitle: {
      color: theme.textSecondary,
      lineHeight: 20,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadow,
      shadowOpacity: 0.05,
      shadowOffset: { width: 0, height: 8 },
      shadowRadius: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.textPrimary,
    },
    sectionDescription: {
      color: theme.textSecondary,
      marginTop: 4,
    },
    sectionLabel: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.textPrimary,
    },
    pillRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 12,
    },
    pill: {
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    pillActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    pillText: {
      fontWeight: "600",
      color: theme.textSecondary,
    },
    pillTextActive: {
      color: "#fff",
    },
    spacingTop: {
      marginTop: 16,
    },
    timeRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 12,
    },
    timeField: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 16,
      padding: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    timeFieldLabel: {
      color: theme.textSecondary,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    timeFieldValue: {
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: "600",
    },
    segmentRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 12,
      flexWrap: "wrap",
    },
    segment: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
      gap: 8,
      justifyContent: "center",
    },
    segmentText: {
      fontWeight: "600",
    },
    toggleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    },
    toggleCopy: {
      flex: 1,
    },
    helper: {
      color: theme.textSecondary,
      marginTop: 4,
      lineHeight: 18,
    },
    saveButton: {
      backgroundColor: theme.accent,
      borderRadius: 999,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: theme.shadow,
      shadowOpacity: 0.2,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 10,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    saveText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.background,
      gap: 12,
    },
    error: {
      textAlign: "center",
      marginTop: 8,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    modalCard: {
      width: "100%",
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "600",
      marginBottom: 12,
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 12,
      marginTop: 12,
    },
    modalButton: {
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    modalPrimary: {
      backgroundColor: theme.accent,
    },
    modalGhost: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalButtonText: {
      fontWeight: "600",
    },
  });
