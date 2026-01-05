import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { createResolution } from "../api/resolutions";
import { useUserId } from "../state/user";
import type { RootStackParamList } from "../../types/navigation";

type NavProp = NativeStackNavigationProp<RootStackParamList, "ResolutionCreate">;

const MIN_TEXT = 5;
const MAX_TEXT = 300;

export default function ResolutionCreateScreen() {
  const navigation = useNavigation<NavProp>();
  const { userId, loading: userLoading } = useUserId();
  const [text, setText] = useState("");
  const [duration, setDuration] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const trimmed = text.trim();
  const durationNumber = duration ? Number(duration) : undefined;
  const durationValid = duration === "" || (Number.isInteger(durationNumber) && durationNumber! >= 1 && durationNumber! <= 52);
  const textValid = trimmed.length >= MIN_TEXT && trimmed.length <= MAX_TEXT;
  const canSubmit = !!userId && textValid && durationValid && !loading && !userLoading;

  const handleSubmit = async () => {
    if (!canSubmit || !userId) return;
    if (!durationValid) {
      setError("Duration should be between 1 and 52 weeks.");
      return;
    }

    setLoading(true);
    setError(null);
    setRequestId(null);

    try {
      const { resolution, requestId: reqId } = await createResolution({
        user_id: userId,
        text: trimmed,
        duration_weeks: durationNumber,
      });
      setRequestId(reqId);
      navigation.replace("PlanReview", { resolutionId: resolution.id, initialResolution: resolution });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create resolution. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (userLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.helper}>Preparing your workspace…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>New Resolution</Text>
      <Text style={styles.helper}>Add a focus area in your own words. We’ll keep it gentle and collaborative.</Text>

      <TextInput
        style={styles.input}
        multiline
        placeholder="Example: Build a mindful morning routine that supports focus."
        value={text}
        onChangeText={setText}
        textAlignVertical="top"
        editable={!loading}
        maxLength={MAX_TEXT}
      />
      <Text style={styles.counter}>
        {trimmed.length}/{MAX_TEXT}
      </Text>

      <TextInput
        style={styles.durationInput}
        placeholder="Duration in weeks (optional, 1-52)"
        value={duration}
        onChangeText={(value) => setDuration(value.replace(/[^0-9]/g, ""))}
        keyboardType="number-pad"
        editable={!loading}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create</Text>}
      </TouchableOpacity>

      {requestId ? (
        <View style={styles.debugCard}>
          <Text style={styles.debugLabel}>Debug</Text>
          <Text style={styles.debugValue}>request_id: {requestId}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() =>
          Alert.alert(
            "Need help?",
            "Try summarizing one supportive habit or project. We'll keep everything in draft until you approve.",
          )
        }
      >
        <Text style={styles.linkText}>Need inspiration?</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flexGrow: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    color: "#111",
  },
  helper: {
    color: "#555",
    marginTop: 8,
    marginBottom: 16,
  },
  input: {
    minHeight: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cfcfcf",
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  counter: {
    alignSelf: "flex-end",
    marginTop: 4,
    color: "#777",
    fontSize: 12,
  },
  durationInput: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cfcfcf",
    padding: 12,
    backgroundColor: "#fff",
  },
  button: {
    marginTop: 20,
    backgroundColor: "#1a73e8",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#8fb5f8",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  error: {
    marginTop: 12,
    color: "#c62828",
  },
  debugCard: {
    marginTop: 20,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#f4f6fb",
    borderWidth: 1,
    borderColor: "#dfe3eb",
  },
  debugLabel: {
    fontWeight: "600",
    color: "#555",
  },
  debugValue: {
    marginTop: 4,
    color: "#111",
  },
  linkButton: {
    marginTop: 12,
    alignItems: "center",
  },
  linkText: {
    color: "#1a73e8",
    fontWeight: "500",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
