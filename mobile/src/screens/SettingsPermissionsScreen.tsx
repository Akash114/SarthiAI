import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { getPreferences, updatePreferences, PreferencesResponse } from "../api/preferences";
import { useUserId } from "../state/user";

export default function SettingsPermissionsScreen() {
  const { userId, loading: userLoading } = useUserId();
  const [prefs, setPrefs] = useState<PreferencesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const fetchPrefs = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, requestId: reqId } = await getPreferences(userId);
      setPrefs(data);
      setRequestId(reqId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load preferences.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userLoading && userId) {
      fetchPrefs();
    }
  }, [fetchPrefs, userId, userLoading]);

  const handleToggle = async (key: keyof Pick<PreferencesResponse, "coaching_paused" | "weekly_plans_enabled" | "interventions_enabled">, value: boolean) => {
    if (!userId) return;
    setSavingKey(key);
    setError(null);
    try {
      const { data, requestId: reqId } = await updatePreferences(userId, { [key]: value });
      setPrefs(data);
      setRequestId(reqId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update preferences.");
    } finally {
      setSavingKey(null);
    }
  };

  if (userLoading || loading && !prefs) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.helper}>Loading your settings…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Settings</Text>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchPrefs}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {prefs ? (
        <View style={styles.card}>
          <SettingRow
            label="Pause coaching"
            description="Pauses all proactive planning until you resume."
            value={prefs.coaching_paused}
            onValueChange={(value) => handleToggle("coaching_paused", value)}
            disabled={savingKey !== null}
          />
          <SettingRow
            label="Weekly plans"
            description="Allow FlowBuddy to generate weekly plans."
            value={prefs.weekly_plans_enabled}
            onValueChange={(value) => handleToggle("weekly_plans_enabled", value)}
            disabled={savingKey !== null || prefs.coaching_paused}
          />
          <SettingRow
            label="Interventions"
            description="Allow proactive check-ins when slippage is detected."
            value={prefs.interventions_enabled}
            onValueChange={(value) => handleToggle("interventions_enabled", value)}
            disabled={savingKey !== null || prefs.coaching_paused}
          />
          <View style={styles.debugBox}>
            <Text style={styles.debugLabel}>request_id: {requestId || prefs.request_id || "—"}</Text>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

type SettingRowProps = {
  label: string;
  description: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
};

function SettingRow({ label, description, value, disabled, onValueChange }: SettingRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} disabled={disabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 16,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  helper: {
    marginTop: 8,
    color: "#666",
  },
  title: {
    fontSize: 26,
    fontWeight: "600",
    color: "#111",
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dfe3ec",
    padding: 16,
    backgroundColor: "#fff",
    gap: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontWeight: "600",
    fontSize: 16,
    color: "#111",
  },
  rowDescription: {
    color: "#555",
    marginTop: 4,
  },
  errorBox: {
    backgroundColor: "#fdecea",
    borderRadius: 12,
    padding: 12,
  },
  error: {
    color: "#c62828",
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
    marginTop: 12,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#f3f4f8",
  },
  debugLabel: {
    fontSize: 12,
    color: "#555",
  },
});
