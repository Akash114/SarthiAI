import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { Brain, CheckCircle, Tag, Quote, User } from "lucide-react-native";

import { getAgentLogItem, AgentLogDetail } from "../api/agentLog";
import { useUserId } from "../state/user";
import type { RootStackParamList } from "../../types/navigation";

type Route = RouteProp<RootStackParamList, "AgentLogDetail">;

export default function AgentLogDetailScreen() {
  const route = useRoute<Route>();
  const { logId } = route.params;
  const { userId, loading: userLoading } = useUserId();

  const [entry, setEntry] = useState<AgentLogDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { item, requestId: reqId } = await getAgentLogItem(userId, logId);
      setEntry(item);
      setRequestId(reqId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load log entry.");
    } finally {
      setLoading(false);
    }
  }, [logId, userId]);

  useEffect(() => {
    if (!userLoading && userId) {
      fetchDetail();
    }
  }, [fetchDetail, userId, userLoading]);

  if (userLoading || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6B8DBF" />
        <Text style={styles.helper}>Loading log entry…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchDetail}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!entry) {
    return (
      <View style={styles.center}>
        <Text style={styles.helper}>Log entry not found.</Text>
      </View>
    );
  }

  const payloadText = JSON.stringify(entry.payload ?? {}, null, 2);
  const createdAt = new Date(entry.created_at).toLocaleString();
  const isBrainDump = entry?.action_type === "brain_dump_analyzed";

  if (isBrainDump) {
    const payload = entry.payload ?? {};
    const signals = payload.signals ?? payload;
    const acknowledgement = signals.acknowledgement ?? "We'll take it one step at a time.";
    const emotions: string[] = Array.isArray(signals.emotions) ? signals.emotions : [];
    const actionableItems: string[] = Array.isArray(signals.actionable_items) ? signals.actionable_items : [];
    const sentiment = typeof signals.sentiment_score === "number" ? signals.sentiment_score : 0;
    const userText = typeof payload.text === "string" ? payload.text : payload.user_input;

    return (
      <ScrollView contentContainerStyle={styles.brainContainer} stickyHeaderIndices={[]}>
        <View style={styles.brainHeader}>
          <View style={styles.brainIconWrapper}>
            <Brain size={42} color="#4338CA" />
          </View>
          <View>
            <Text style={styles.brainLabel}>Mental Clear</Text>
            <Text style={styles.brainTimestamp}>{createdAt}</Text>
          </View>
        </View>

        {userText ? (
          <View style={styles.userCard}>
            <View style={styles.userHeader}>
              <User size={18} color="#475569" />
              <Text style={styles.userLabel}>You wrote</Text>
            </View>
            <Text style={styles.userText}>{userText}</Text>
          </View>
        ) : null}

        <View style={styles.brainHero}>
          <Quote size={26} color="#3730A3" />
          <Text style={styles.brainQuote}>"{acknowledgement}"</Text>
          <Text style={styles.brainSentiment}>Sentiment score: {sentiment.toFixed(2)}</Text>
        </View>

        {emotions.length ? (
          <View style={styles.brainSection}>
            <Text style={styles.sectionLabel}>Detected Signals</Text>
            <View style={styles.pillRow}>
              {emotions.map((emotion) => (
                <View key={emotion} style={styles.pill}>
                  <Tag size={14} color="#4C1D95" />
                  <Text style={styles.pillText}>{emotion}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {actionableItems.length ? (
          <View style={styles.brainSection}>
            <Text style={styles.sectionLabel}>Suggested Actions</Text>
            {actionableItems.map((item) => (
              <View key={item} style={styles.actionRow}>
                <CheckCircle size={18} color="#047857" />
                <Text style={styles.actionText}>{item}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.payloadBox}>
          <Text style={styles.payloadLabel}>System Payload</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <Text style={styles.payloadText}>{payloadText}</Text>
          </ScrollView>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} stickyHeaderIndices={[]}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Action Detail</Text>
        <Text style={styles.timestamp}>{createdAt}</Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summary}>{entry.summary}</Text>
        <Text style={[styles.badge, styles.badgeBlue]}>{entry.action_type}</Text>
      </View>

      <View style={styles.metaCard}>
        <InfoRow label="Action type" value={entry.action_type} />
        <InfoRow label="Undo available" value={entry.undo_available ? "Yes" : "No"} />
        {entry.request_id ? <InfoRow label="request_id" value={entry.request_id} /> : null}
        {requestId ? <InfoRow label="request_id header" value={requestId} /> : null}
      </View>

      <View style={styles.payloadBox}>
        <Text style={styles.payloadLabel}>System Payload</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <Text style={styles.payloadText}>{payloadText}</Text>
        </ScrollView>
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
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
    padding: 16,
    backgroundColor: "#FAFAF8",
  },
  helper: {
    marginTop: 8,
    color: "#666",
    textAlign: "center",
  },
  error: {
    color: "#c62828",
    textAlign: "center",
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#c62828",
  },
  retryText: {
    color: "#c62828",
    fontWeight: "600",
  },
  header: {
    gap: 4,
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#6B7280",
  },
  timestamp: {
    fontSize: 22,
    color: "#2D3748",
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    gap: 10,
  },
  summary: {
    fontSize: 20,
    color: "#2D3748",
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
  },
  badge: {
    alignSelf: "flex-start",
    fontSize: 12,
    textTransform: "uppercase",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontWeight: "600",
  },
  badgeBlue: {
    backgroundColor: "#DBEAFE",
    color: "#1D4ED8",
  },
  metaCard: {
    borderRadius: 16,
    backgroundColor: "#fff",
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    gap: 8,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111",
    flex: 1,
    textAlign: "right",
  },
  payloadBox: {
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
  },
  payloadLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
    marginBottom: 8,
  },
  payloadText: {
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
    fontSize: 12,
    color: "#111",
    minWidth: 250,
  },
  brainContainer: {
    padding: 24,
    gap: 24,
    backgroundColor: "#F5F3FF",
  },
  brainHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  brainIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#E0E7FF",
    alignItems: "center",
    justifyContent: "center",
  },
  brainLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#312E81",
  },
  brainTimestamp: {
    color: "#4338CA",
  },
  brainHero: {
    backgroundColor: "#EEF2FF",
    borderRadius: 24,
    padding: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E0E7FF",
  },
  brainQuote: {
    fontSize: 22,
    fontStyle: "italic",
    color: "#312E81",
    fontFamily: Platform.select({ ios: "Georgia", default: "serif" }),
  },
  brainSentiment: {
    color: "#4C1D95",
    fontWeight: "600",
  },
  brainSection: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#312E81",
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#DDD6FE",
  },
  pillText: {
    color: "#4C1D95",
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  actionText: {
    color: "#065F46",
    fontWeight: "600",
  },
  userCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
  },
  userText: {
    fontSize: 16,
    color: "#1F2937",
    lineHeight: 24,
  },
});
