import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pause, Play, Wind, X, CheckCircle2, BellOff } from "lucide-react-native";
import type { RootStackParamList } from "../../types/navigation";
import { useTheme } from "../theme";
import * as Notifications from "expo-notifications";
import { updateTaskCompletion } from "../api/tasks";
import { useUserId } from "../state/user";
import BrainDumpModal from "./components/BrainDumpModal";

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const QUIET_HANDLER = {
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
};

const DEFAULT_HANDLER = {
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
};

export default function FocusModeScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProp<RootStackParamList, "FocusMode">>();
  const { taskTitle, durationMinutes, taskId } = route.params;
  const { theme } = useTheme();
  const { userId } = useUserId();
  const initialSeconds = useMemo(() => Math.max(60, Math.round(durationMinutes * 60)), [durationMinutes]);
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [isActive, setIsActive] = useState(true);
  const [capturedThoughts, setCapturedThoughts] = useState<string[]>([]);
  const [brainDumpVisible, setBrainDumpVisible] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [dndActive, setDndActive] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const ambientPulse = useRef(new Animated.Value(0)).current;
  const glowStyle = {
    opacity: ambientPulse.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.22] }),
    transform: [
      {
        scale: ambientPulse.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.08] }),
      },
    ],
  };

  useEffect(() => {
    if (!isActive || brainDumpVisible) {
      return;
    }
    if (timeLeft <= 0) {
      setIsActive(false);
      return;
    }
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive, brainDumpVisible, timeLeft]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(ambientPulse, { toValue: 1, duration: 4000, useNativeDriver: true }),
        Animated.timing(ambientPulse, { toValue: 0, duration: 4000, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [ambientPulse]);

  const formattedTime = useMemo(() => {
    const minutes = Math.floor(timeLeft / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (timeLeft % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [timeLeft]);

  const minutesElapsed = Math.max(0, Math.floor((initialSeconds - timeLeft) / 60));
  const minutesRemaining = Math.max(0, Math.ceil(timeLeft / 60));
  const progressPercent = initialSeconds ? Math.min(100, Math.round(((initialSeconds - timeLeft) / initialSeconds) * 100)) : 0;

  const handleToggleTimer = () => {
    if (timeLeft === 0) return;
    setIsActive((prev) => !prev);
  };

  useEffect(() => {
    let mounted = true;
    const enableDnd = async () => {
      try {
        await Notifications.setNotificationHandler(QUIET_HANDLER);
        if (mounted) setDndActive(true);
      } catch {
        // ignore
      }
    };
    enableDnd();
    return () => {
      mounted = false;
      (async () => {
        try {
          await Notifications.setNotificationHandler(DEFAULT_HANDLER);
        } catch {
          // ignore
        }
      })();
    };
  }, []);

  const handleDistracted = () => {
    setIsActive(false);
    setBrainDumpVisible(true);
  };

  const finishSession = async () => {
    if (completing) return;
    if (taskId && !userId) {
      setCompleteError("Still loading your account. Try again in a moment.");
      return;
    }
    setCompleting(true);
    setCompleteError(null);
    try {
      if (taskId && userId) {
        await updateTaskCompletion(taskId, userId, true);
      }
      navigation.goBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to mark that task complete right now.";
      setCompleteError(message);
      Alert.alert("Task completion", message);
    } finally {
      setCompleting(false);
    }
  };

  const handleCompleteTask = () => {
    if (completing) return;
    Alert.alert("Complete focus?", "Wrap up this session and mark it complete?", [
      { text: "Keep Going", style: "cancel" },
      {
        text: "Complete",
        style: "destructive",
        onPress: finishSession,
      },
    ]);
  };

  const handleBrainDumpSaved = (entry: {
    acknowledgement: string;
    actionable: boolean;
    actionableItems: string[];
    topics: string[];
    sentiment: number;
    text: string;
  }) => {
    setCapturedThoughts((prev) => [...prev, entry.text]);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={[styles.fullContainer, { backgroundColor: theme.background }]}>
        <Animated.View pointerEvents="none" style={[styles.ambientGlow, glowStyle, { backgroundColor: theme.accent }]} />
        <View style={styles.headerRow}>
          <View style={styles.sessionHeaderLeft}>
            <Text style={[styles.headerLabel, { color: theme.textMuted }]}>Focus companion</Text>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]} numberOfLines={2}>
              {taskTitle}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.closeButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Exit focus mode"
          >
            <X color={theme.textPrimary} size={20} />
          </TouchableOpacity>
        </View>

        <View style={styles.dndRow}>
          <BellOff size={14} color={theme.textSecondary} />
          <Text style={[styles.dndText, { color: theme.textSecondary }]}>
            Quiet mode {dndActive ? "enabled" : "starting…"}
          </Text>
        </View>

        <View style={[styles.timerSection, { backgroundColor: theme.heroPrimary, borderColor: theme.border }]}>
          <Text style={[styles.timerText, { color: "#fff" }]}>{formattedTime}</Text>
          <View style={[styles.progressTrack, { backgroundColor: theme.surface }]}>
            <View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: theme.accent }]} />
          </View>
          <View style={styles.metricsRow}>
            <Text style={[styles.metricText, { color: theme.textSecondary }]}>{minutesElapsed}m in</Text>
            <Text style={[styles.metricText, { color: theme.textSecondary }]}>{minutesRemaining}m left</Text>
          </View>
        </View>

        <View style={styles.primaryActions}>
          <TouchableOpacity
            style={[styles.focusButton, styles.primaryButton, { backgroundColor: isActive ? theme.danger : theme.success }]}
            onPress={handleToggleTimer}
          >
            {isActive ? <Pause size={18} color="#fff" /> : <Play size={18} color="#fff" />}
            <Text style={styles.primaryButtonText}>{isActive ? "Pause" : "Resume"}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.focusButton, styles.secondaryButton, { borderColor: theme.border }]}
            onPress={handleDistracted}
          >
            <Wind size={18} color={theme.textPrimary} />
            <Text style={[styles.secondaryButtonText, { color: theme.textPrimary }]}>Save a thought</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.focusButton, styles.secondaryButton, { borderColor: theme.border }]}
            onPress={handleCompleteTask}
            disabled={completing}
          >
            <CheckCircle2 size={18} color={theme.textPrimary} />
            <Text style={[styles.secondaryButtonText, { color: theme.textPrimary }]}>
              {completing ? "Ending…" : "End session"}
            </Text>
          </TouchableOpacity>
          {completeError ? <Text style={[styles.errorText, { color: theme.danger }]}>{completeError}</Text> : null}
        </View>

        {!detailsVisible ? (
          <TouchableOpacity
            style={[styles.moreButton, { borderColor: theme.border }]}
            onPress={() => setDetailsVisible(true)}
          >
            <Text style={[styles.moreButtonText, { color: theme.textSecondary }]}>Open insights</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.insightsSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sectionHeading, { color: theme.textPrimary }]}>Captured thoughts</Text>
              <TouchableOpacity onPress={() => setDetailsVisible(false)}>
                <Text style={[styles.sheetCloseText, { color: theme.textSecondary }]}>Hide</Text>
              </TouchableOpacity>
            </View>
            {capturedThoughts.length ? (
              capturedThoughts.slice(-5).map((thought, index) => (
                <Text key={`${thought}-${index}`} style={[styles.thoughtText, { color: theme.textSecondary }]}>
                  • {thought}
                </Text>
              ))
            ) : (
              <Text style={[styles.emptyThoughtText, { color: theme.textSecondary }]}>All clear for now.</Text>
            )}
          </View>
        )}
      </View>

      <BrainDumpModal
        visible={brainDumpVisible}
        onClose={() => {
          setBrainDumpVisible(false);
          if (timeLeft > 0) {
            setIsActive(true);
          }
        }}
        onSaved={handleBrainDumpSaved}
        title="Capture your thought"
        subtitle="Park it here and we’ll keep it safe outside the session."
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  fullContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
    gap: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  headerLabel: {
    fontSize: 12,
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  sessionHeaderLeft: {
    flex: 1,
    paddingRight: 12,
  },
  dndRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dndText: {
    fontSize: 13,
  },
  ambientGlow: {
    position: "absolute",
    top: -80,
    left: -80,
    right: -80,
    height: 360,
    borderRadius: 360,
  },
  timerSection: {
    borderRadius: 32,
    paddingVertical: 42,
    paddingHorizontal: 28,
    borderWidth: 1,
    alignItems: "center",
    shadowOpacity: 0.2,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 12 },
  },
  timerText: {
    fontSize: 80,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    letterSpacing: 2,
    textAlign: "center",
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 16,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
  },
  metricText: {
    fontSize: 14,
    fontWeight: "600",
  },
  primaryActions: {
    marginTop: 24,
    gap: 12,
  },
  focusButton: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  primaryButton: {
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryButton: {
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  secondaryButtonText: {
    fontWeight: "600",
    fontSize: 15,
  },
  moreButton: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  moreButtonText: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  insightsSheet: {
    marginTop: 16,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sheetCloseText: {
    fontSize: 13,
    fontWeight: "600",
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "600",
  },
  thoughtText: {
    marginTop: 8,
    lineHeight: 20,
  },
  emptyThoughtText: {
    marginTop: 8,
    fontStyle: "italic",
  },
  errorText: {
    marginTop: 4,
    fontSize: 13,
    textAlign: "center",
  },
});
