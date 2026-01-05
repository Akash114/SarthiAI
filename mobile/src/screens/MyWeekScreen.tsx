import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import type { RootStackParamList } from "../../types/navigation";
import { listTasks, TaskItem } from "../api/tasks";
import { useUserId } from "../state/user";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "MyWeek">;

type TaskSection = {
  title: string;
  data: TaskItem[];
};

export default function MyWeekScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { userId, loading: userLoading } = useUserId();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const grouped = useMemo<TaskSection[]>(() => {
    const scheduled = tasks.filter((task) => !!task.scheduled_day);
    const unscheduled = tasks.filter((task) => !task.scheduled_day);
    const sections: TaskSection[] = [];
    if (scheduled.length) {
      sections.push({ title: "Scheduled", data: scheduled });
    }
    if (unscheduled.length) {
      sections.push({ title: "Unscheduled", data: unscheduled });
    }
    return sections;
  }, [tasks]);

  const loadTasks = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { tasks: list, requestId: reqId } = await listTasks(userId, { status: "active" });
      setTasks(list);
      setRequestId(reqId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load tasks right now.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!userLoading && userId) {
      loadTasks();
    }
  }, [userLoading, userId]);

  const renderItem = ({ item }: { item: TaskItem }) => (
    <View style={styles.card}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.meta}>
        {item.scheduled_day ? item.scheduled_day : "Flexible"}
        {item.scheduled_time ? ` · ${item.scheduled_time}` : ""}
      </Text>
      {item.duration_min ? <Text style={styles.meta}>{item.duration_min} min</Text> : null}
      {item.completed ? <Text style={styles.badge}>Done</Text> : null}
    </View>
  );

  if (userLoading || (loading && !refreshing && !tasks.length)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.helper}>Gathering your week…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.retry} onPress={loadTasks}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!tasks.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>No active tasks yet</Text>
        <Text style={styles.helper}>Approve a plan to fill your week with gentle supports.</Text>
        <TouchableOpacity style={styles.retry} onPress={() => navigation.navigate("ResolutionCreate")}>
          <Text style={styles.retryText}>Create a resolution</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SectionList
        sections={grouped}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          loadTasks();
        }}
        contentContainerStyle={styles.listContent}
      />
      {requestId ? (
        <View style={styles.debugCard}>
          <Text style={styles.debugLabel}>Debug</Text>
          <Text style={styles.debugValue}>request_id: {requestId}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  sectionHeader: {
    fontWeight: "600",
    fontSize: 16,
    marginTop: 12,
    marginBottom: 6,
    color: "#111",
  },
  card: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e4ef",
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
  },
  meta: {
    color: "#555",
    marginTop: 4,
  },
  badge: {
    marginTop: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#c8e6c9",
    color: "#1b5e20",
    fontWeight: "600",
    fontSize: 12,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  helper: {
    marginTop: 8,
    color: "#666",
    textAlign: "center",
  },
  error: {
    color: "#c62828",
    fontSize: 16,
    textAlign: "center",
  },
  retry: {
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1a73e8",
  },
  retryText: {
    color: "#1a73e8",
    fontWeight: "600",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111",
  },
  debugCard: {
    padding: 12,
    borderTopWidth: 1,
    borderColor: "#e6e9f2",
  },
  debugLabel: {
    fontWeight: "600",
    color: "#555",
  },
  debugValue: {
    marginTop: 4,
    color: "#111",
  },
});
