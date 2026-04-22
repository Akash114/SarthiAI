import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTheme } from '../theme';
import { Screen, AppHeader, Card } from '../components';
import { useTask } from '../hooks/queries';
import type { PlanStackScreenProps } from '../navigation/types';

export function TaskDetailScreen({ navigation, route }: PlanStackScreenProps<'TaskDetail'>) {
  const { colors, spacing } = useTheme();
  const taskId = route.params.taskId;
  const { data: task, isPending } = useTask(taskId);

  return (
    <Screen>
      <AppHeader title="Task" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {isPending ? (
          <Text style={{ color: colors.textMuted }}>Loading…</Text>
        ) : task ? (
          <>
            <Card style={{ marginBottom: spacing.md }}>
              <Text style={[{ color: colors.text, fontWeight: '700', fontSize: 18 }]}>{task.title}</Text>
              <Text style={[{ color: colors.textMuted, marginTop: spacing.sm }]}>Status: {task.status}</Text>
            </Card>
            {(task.due_window_starts_at || task.due_window_ends_at) && (
              <Card style={{ marginBottom: spacing.md }}>
                <Text style={[{ color: colors.textSecondary, fontSize: 13 }]}>Due window</Text>
                {task.due_window_starts_at ? (
                  <Text style={[{ color: colors.text, marginTop: 4 }]}>
                    Starts: {new Date(task.due_window_starts_at).toLocaleString()}
                  </Text>
                ) : null}
                {task.due_window_ends_at ? (
                  <Text style={[{ color: colors.text, marginTop: 4 }]}>
                    Ends: {new Date(task.due_window_ends_at).toLocaleString()}
                  </Text>
                ) : null}
              </Card>
            )}
            {task.metadata_json && Object.keys(task.metadata_json).length > 0 ? (
              <Card>
                <Text style={[{ color: colors.textSecondary, fontSize: 13, marginBottom: spacing.xs }]}>Metadata</Text>
                <Text style={[{ color: colors.textMuted, fontSize: 12 }]}>{JSON.stringify(task.metadata_json, null, 2)}</Text>
              </Card>
            ) : null}
          </>
        ) : (
          <Text style={{ color: colors.textMuted }}>Task not found.</Text>
        )}
      </ScrollView>
    </Screen>
  );
}
