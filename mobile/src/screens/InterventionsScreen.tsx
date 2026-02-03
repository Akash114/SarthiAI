import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  Alert,
} from "react-native";
import { ShieldAlert, CheckCircle, ArrowRight } from "lucide-react-native";
import {
  getInterventionsLatest,
  runInterventions,
  respondToIntervention,
  InterventionSnapshot,
} from "../api/interventions";
import { useUserId } from "../state/user";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../types/navigation";
import { useActiveResolutions } from "../hooks/useActiveResolutions";
import { useTheme } from "../theme";

type Nav = NativeStackNavigationProp<RootStackParamList, "Interventions">;

export default function InterventionsScreen() {
  const { userId, loading: userLoading } = useUserId();
  const navigation = useNavigation<Nav>();
  const {
    hasActiveResolutions,
    loading: activeResolutionsLoading,
    refresh: refreshActiveResolutions,
  } = useActiveResolutions(userId);
  const [snapshot, setSnapshot] = useState<InterventionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState(false);
  const [respondingKey, setRespondingKey] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [lastAction, setLastAction] = useState<{ message: string; changes: string[] } | null>(null);
  const { theme } = useTheme();
  const backgroundColor = theme.background;
  const surface = theme.card;
  const borderColor = theme.border;
  const textPrimary = theme.textPrimary;
  const textSecondary = theme.textSecondary;
  const accent = theme.accent;

  const fetchSnapshot = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { intervention, requestId: reqId, notFound: none } = await getInterventionsLatest(userId);
      setSnapshot(intervention);
      setRequestId(reqId);
      setNotFound(none);
      if (__DEV__) {
        console.log("[Interventions] latest snapshot", {
          hasSnapshot: Boolean(intervention),
          flagged: intervention?.slippage?.flagged,
          hasCard: Boolean(intervention?.card),
          optionCount: intervention?.card?.options?.length ?? 0,
          requestId: reqId,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load interventions.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userLoading && userId && hasActiveResolutions !== null) {
      if (hasActiveResolutions) {
        fetchSnapshot();
      } else {
        setSnapshot(null);
        setLoading(false);
        setNotFound(true);
      }
    }
  }, [fetchSnapshot, userId, userLoading, hasActiveResolutions]);

  const hasRunInitialFocus = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasRunInitialFocus.current) {
        hasRunInitialFocus.current = true;
        return;
      }
      refreshActiveResolutions();
    }, [refreshActiveResolutions]),
  );

  const handleGenerate = async () => {
    if (!userId) return;
    setRunning(true);
    setError(null);
    try {
      const { intervention, requestId: reqId } = await runInterventions(userId);
      setSnapshot(intervention);
      setRequestId(reqId);
      setNotFound(false);
      if (__DEV__) {
        console.log("[Interventions] run snapshot", {
          hasSnapshot: Boolean(intervention),
          flagged: intervention?.slippage?.flagged,
          hasCard: Boolean(intervention?.card),
          optionCount: intervention?.card?.options?.length ?? 0,
          requestId: reqId,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate check-in.");
    } finally {
      setRunning(false);
    }
  };

  const handleOptionSelect = useCallback(
    async (optionKey: string) => {
      if (!userId || actionLoading) {
        return;
      }
      setActionLoading(true);
      setRespondingKey(optionKey);
      try {
        const { message, changes, snapshot: updatedSnapshot } = await respondToIntervention(userId, optionKey);
        setLastAction({ message, changes });
        if (updatedSnapshot) {
          setSnapshot(updatedSnapshot);
        }
      } catch (err) {
        Alert.alert("Intervention", err instanceof Error ? err.message : "Unable to apply that option right now.");
      } finally {
        setRespondingKey(null);
        setActionLoading(false);
      }
    },
    [userId, actionLoading],
  );

  if (!userLoading && !activeResolutionsLoading && hasActiveResolutions === false) {
    return (
      <View style={[styles.center, { backgroundColor }]}>
        <Text style={[styles.emptyTitle, { color: textPrimary }]}>Add a resolution first</Text>
        <Text style={[styles.helper, { color: textSecondary }]}>Coaching kicks in once you approve your first resolution.</Text>
        <TouchableOpacity style={[styles.button, { backgroundColor: accent }]} onPress={() => navigation.navigate("ResolutionCreate")}>
          <Text style={styles.buttonText}>Create Resolution</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkButton} onPress={refreshActiveResolutions}>
          <Text style={[styles.linkText, { color: accent }]}>Check again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if ((userLoading || loading || activeResolutionsLoading) && !refreshing) {
    return (
      <View style={[styles.center, { backgroundColor }]}>
        <ActivityIndicator color={accent} />
        <Text style={[styles.helper, { color: textSecondary }]}>Preparing your check-in…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSnapshot(); }} tintColor={accent} />
      }
    >
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: textPrimary }]}>Interventions</Text>
        <TouchableOpacity style={styles.linkButton} onPress={() => navigation.navigate("InterventionsHistory")}>
          <Text style={[styles.linkText, { color: accent }]}>History</Text>
        </TouchableOpacity>
      </View>
      {error ? (
        <View style={[styles.errorBox, { backgroundColor: theme.accentSoft }]}>
          <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryButton, { borderColor: theme.danger }]} onPress={fetchSnapshot}>
            <Text style={[styles.retryText, { color: theme.danger }]}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : null}

          {snapshot ? (
            <>
              <StatusCard snapshot={snapshot} />
              {lastAction ? (
                <View style={styles.actionResult}>
                  <Text style={styles.actionResultTitle}>Action applied</Text>
                  <Text style={styles.actionResultCopy}>{lastAction.message}</Text>
                  {lastAction.changes?.length ? (
                    <View style={styles.actionResultList}>
                      {lastAction.changes.map((change, idx) => (
                        <Text key={`change-${idx}`} style={styles.actionResultItem}>
                          • {change}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  <View style={styles.actionResultButtons}>
                    <TouchableOpacity style={styles.secondaryButton} onPress={() => setLastAction(null)}>
                      <Text style={styles.secondaryButtonText}>Dismiss</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.primaryCTA} onPress={() => navigation.navigate("MyWeek")}>
                      <Text style={styles.primaryCTAText}>Review My Week</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
              {snapshot.slippage.flagged && snapshot.card ? (
            <View style={styles.suggestionCard}>
              <Text style={styles.suggestionTitle}>Agent Suggestion</Text>
              <Text style={styles.suggestionMessage}>{snapshot.card.message}</Text>
              {snapshot.card.options.map((option) => {
                const theme = getOptionTheme(option.key);
                const busy = respondingKey === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.optionButton,
                      { backgroundColor: theme.backgroundColor, borderColor: theme.borderColor },
                      busy && styles.optionButtonBusy,
                    ]}
                    onPress={() => handleOptionSelect(option.key)}
                    disabled={busy || actionLoading}
                    activeOpacity={0.8}
                  >
                    <View style={styles.optionHeader}>
                      <View style={styles.optionLabelWrapper}>
                        <Text style={[styles.optionLabel, { color: theme.labelColor }]}>{option.label}</Text>
                        <Text style={[styles.optionPill, { color: theme.pillColor, backgroundColor: theme.pillBackground }]}>
                          {theme.pillText}
                        </Text>
                      </View>
                      {busy ? <ActivityIndicator size="small" color="#1F2933" /> : null}
                      {!busy ? <ArrowRight size={16} color={theme.iconColor} /> : null}
                    </View>
                    <Text style={[styles.optionDetails, { color: theme.detailColor }]}>{option.details}</Text>
                    <Text style={[styles.optionCTA, { color: theme.ctaColor }]}>Try this</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          <View style={styles.debugBox}>
            <Text style={styles.debugLabel}>Req ID: {requestId || snapshot.request_id || "—"}</Text>
          </View>
        </>
      ) : null}

      {!snapshot && hasActiveResolutions ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No check-in needed yet.</Text>
          <Text style={styles.helper}>Check back Thursday!</Text>
          <TouchableOpacity
            style={[styles.button, running && styles.buttonDisabled]}
            onPress={handleGenerate}
            disabled={running}
          >
            {running ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Generate Check-in</Text>}
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
}

function StatusCard({ snapshot }: { snapshot: InterventionSnapshot }) {
  const flagged = snapshot.slippage.flagged;
  const completion = Math.round(snapshot.slippage.completion_rate * 100);
  const theme = flagged
    ? { card: styles.warningCard, icon: <ShieldAlert size={42} color="#B45309" />, title: "Slippage detected" }
    : { card: styles.safeCard, icon: <CheckCircle size={42} color="#15803D" />, title: "On track" };
  return (
    <View style={[styles.statusCard, theme.card]}>
      {theme.icon}
      <View style={styles.statusContent}>
        <Text style={styles.statusTitle}>{theme.title}</Text>
        <Text style={styles.statusMeta}>Completion Rate: {completion}%</Text>
        <Text style={styles.statusMeta}>Missed scheduled: {snapshot.slippage.missed_scheduled}</Text>
      </View>
    </View>
  );
}

type OptionTheme = {
  backgroundColor: string;
  borderColor: string;
  labelColor: string;
  detailColor: string;
  iconColor: string;
  pillColor: string;
  pillBackground: string;
  pillText: string;
  ctaColor: string;
};

function getOptionTheme(key: string): OptionTheme {
  const themes: Record<string, OptionTheme> = {
    reduce_scope: {
      backgroundColor: "#FFF7ED",
      borderColor: "#FDBA74",
      labelColor: "#9A3412",
      detailColor: "#7C2D12",
      iconColor: "#C2410C",
      pillColor: "#B45309",
      pillBackground: "#FED7AA",
      pillText: "Lighten it",
      ctaColor: "#9A3412",
    },
    reschedule: {
      backgroundColor: "#EFF6FF",
      borderColor: "#BFDBFE",
      labelColor: "#1E3A8A",
      detailColor: "#1E40AF",
      iconColor: "#2563EB",
      pillColor: "#1D4ED8",
      pillBackground: "#DBEAFE",
      pillText: "Shift it",
      ctaColor: "#1D4ED8",
    },
    reflect: {
      backgroundColor: "#F0FDF4",
      borderColor: "#BBF7D0",
      labelColor: "#166534",
      detailColor: "#14532D",
      iconColor: "#15803D",
      pillColor: "#15803D",
      pillBackground: "#DCFCE7",
      pillText: "Reflect",
      ctaColor: "#166534",
    },
    pause: {
      backgroundColor: "#FDF4FF",
      borderColor: "#F5D0FE",
      labelColor: "#86198F",
      detailColor: "#701A75",
      iconColor: "#A21CAF",
      pillColor: "#A21CAF",
      pillBackground: "#FBE7FF",
      pillText: "Pause",
      ctaColor: "#86198F",
    },
    adjust_goal: {
      backgroundColor: "#EEF2FF",
      borderColor: "#C7D2FE",
      labelColor: "#3730A3",
      detailColor: "#312E81",
      iconColor: "#4C1D95",
      pillColor: "#4338CA",
      pillBackground: "#E0E7FF",
      pillText: "Adjust",
      ctaColor: "#3730A3",
    },
    get_back_on_track: {
      backgroundColor: "#F0FDFA",
      borderColor: "#99F6E4",
      labelColor: "#115E59",
      detailColor: "#134E4A",
      iconColor: "#0F766E",
      pillColor: "#0F766E",
      pillBackground: "#CCFBF1",
      pillText: "Recommit",
      ctaColor: "#115E59",
    },
  };

  return themes[key] || {
    backgroundColor: "#F9FAFB",
    borderColor: "#E5E7EB",
    labelColor: "#1F2937",
    detailColor: "#374151",
    iconColor: "#4B5563",
    pillColor: "#111827",
    pillBackground: "#E5E7EB",
    pillText: "Action",
    ctaColor: "#1F2937",
  };
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 16,
    backgroundColor: "#FAFAF8",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#FAFAF8",
  },
  title: {
    fontSize: 28,
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
    color: "#2D3748",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  linkButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  linkText: {
    color: "#6B8DBF",
    fontWeight: "600",
  },
  statusCard: {
    borderRadius: 24,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  warningCard: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  safeCard: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1F2933",
  },
  statusMeta: {
    color: "#475467",
    marginTop: 4,
  },
  suggestionCard: {
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  suggestionTitle: {
    fontWeight: "600",
    color: "#1F2933",
  },
  suggestionMessage: {
    marginTop: 6,
    color: "#4B5563",
  },
  optionButton: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  optionButtonBusy: {
    opacity: 0.6,
  },
  optionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  optionLabelWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  optionLabel: {
    fontWeight: "600",
    color: "#1F2933",
  },
  optionPill: {
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    fontWeight: "600",
  },
  optionDetails: {
    color: "#6B7280",
    marginTop: 4,
  },
  optionCTA: {
    marginTop: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    fontSize: 12,
    letterSpacing: 0.6,
  },
  button: {
    marginTop: 16,
    backgroundColor: "#6B8DBF",
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  buttonDisabled: {
    backgroundColor: "#A5B8D9",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  helper: {
    marginTop: 8,
    color: "#666",
    textAlign: "center",
  },
  actionResult: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    backgroundColor: "#EEF2FF",
  },
  actionResultTitle: {
    fontWeight: "700",
    color: "#312E81",
  },
  actionResultCopy: {
    marginTop: 6,
    color: "#1E1B4B",
  },
  actionResultList: {
    marginTop: 8,
    gap: 4,
  },
  actionResultItem: {
    color: "#312E81",
    fontSize: 13,
  },
  actionResultButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 12,
    flexWrap: "wrap",
  },
  secondaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#94A3B8",
  },
  secondaryButtonText: {
    color: "#475569",
    fontWeight: "600",
  },
  primaryCTA: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#4C1D95",
  },
  primaryCTAText: {
    color: "#FFF",
    fontWeight: "600",
  },
  emptyCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 24,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: 12,
    color: "#1F2933",
  },
  error: {
    color: "#c62828",
  },
  errorBox: {
    backgroundColor: "#fdecea",
    borderRadius: 12,
    padding: 12,
  },
  retryButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#c62828",
  },
  retryText: {
    color: "#c62828",
    fontWeight: "600",
  },
  debugBox: {
    marginTop: 16,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#f3f4f8",
  },
  debugLabel: {
    fontSize: 12,
    color: "#555",
    textAlign: "center",
  },
});
