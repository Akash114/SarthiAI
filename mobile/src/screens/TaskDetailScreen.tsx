import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppHeader, Button, Card, FixedScreen } from '../components';
import { useTask } from '../hooks/queries';
import { useCompleteTask, useReopenTask } from '../hooks/mutations';
import type { GoalsStackScreenProps, HomeStackScreenProps } from '../navigation/types';
import { useTheme } from '../theme';

type Props = GoalsStackScreenProps<'TaskDetail'> | HomeStackScreenProps<'TaskDetail'>;

export function TaskDetailScreen({ navigation, route }: Props) {
  const { colors, spacing, typography } = useTheme();
  const taskId = route.params.taskId;
  const { data: task, isPending } = useTask(taskId);
  const completeTask = useCompleteTask(taskId);
  const reopenTask = useReopenTask(taskId);

  return (
    <FixedScreen
      header={<AppHeader title="Task" onBack={() => navigation.goBack()} />}
      footer={
        task ? (
          <View style={{ gap: spacing.sm }}>
            <Button title="Edit" variant="ghost" onPress={() => navigation.getParent()?.navigate('GoalsTab', { screen: 'EditTask', params: { taskId } })} />
            {task.status === 'open' ? (
              <Button title="Complete" onPress={() => completeTask.mutate()} loading={completeTask.isPending} />
            ) : (
              <Button title="Reopen" onPress={() => reopenTask.mutate()} loading={reopenTask.isPending} />
            )}
          </View>
        ) : undefined
      }
    >
      {isPending ? <Text style={{ color: colors.textMuted }}>Loading task...</Text> : null}
      {task ? (
        <>
          <Text numberOfLines={3} style={[typography.title, { color: colors.text }]}>
            {task.title}
          </Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            {task.status} · {task.priority} · {task.owner_type}
          </Text>
          <Card style={{ marginTop: spacing.md }}>
            <Text style={[styles.label, { color: colors.textMuted }]}>NOTES</Text>
            <Text numberOfLines={6} style={{ color: colors.text, marginTop: 6 }}>
              {task.notes || 'No notes yet.'}
            </Text>
          </Card>
          <Card style={{ marginTop: spacing.md }}>
            <Text style={[styles.label, { color: colors.textMuted }]}>SCHEDULE</Text>
            <Text style={{ color: colors.textSecondary, marginTop: 6 }}>
              {task.due_at ? `Due ${new Date(task.due_at).toLocaleString()}` : 'No due date'}
            </Text>
          </Card>
        </>
      ) : null}
    </FixedScreen>
  );
}

const styles = StyleSheet.create({
  meta: { fontSize: 13, marginTop: 6, textTransform: 'capitalize' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
});
