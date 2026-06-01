import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppHeader, Button, Card, FixedScreen, Modal, TaskRow } from '../components';
import { useGoal, useGoalTasks } from '../hooks/queries';
import { useCompleteGoal, useCreateTask } from '../hooks/mutations';
import type { GoalsStackScreenProps } from '../navigation/types';
import { useTheme } from '../theme';

export function GoalDetailScreen({ navigation, route }: GoalsStackScreenProps<'GoalDetail'>) {
  const { colors, spacing, typography } = useTheme();
  const goalId = route.params.goalId;
  const { data: goal } = useGoal(goalId);
  const { data: taskPage } = useGoalTasks(goalId, 'open');
  const completeGoal = useCompleteGoal(goalId);
  const createTask = useCreateTask();
  const [modalOpen, setModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const tasks = taskPage?.tasks ?? [];

  const submitTask = async () => {
    const title = taskTitle.trim();
    if (!title) return;
    try {
      await createTask.mutateAsync({ title, goal_id: goalId, team_id: goal?.team_id ?? undefined });
      setTaskTitle('');
      setModalOpen(false);
    } catch (e) {
      Alert.alert('Could not create task', e instanceof Error ? e.message : 'Try again.');
    }
  };

  return (
    <FixedScreen
      header={<AppHeader title="Goal" onBack={() => navigation.goBack()} />}
      footer={
        <View style={{ gap: spacing.sm }}>
          <Button title="Add task" onPress={() => setModalOpen(true)} />
          {goal?.status === 'active' ? (
            <Button
              title="Complete goal"
              variant="ghost"
              onPress={() => completeGoal.mutate()}
              loading={completeGoal.isPending}
            />
          ) : null}
        </View>
      }
    >
      <Text numberOfLines={2} style={[typography.title, { color: colors.text }]}>
        {goal?.title ?? 'Loading goal...'}
      </Text>
      <Text numberOfLines={3} style={[styles.summary, { color: colors.textSecondary }]}>
        {goal?.progress_summary || goal?.description || 'No progress summary yet.'}
      </Text>
      <Card style={{ marginTop: spacing.md }}>
        <Text style={[styles.label, { color: colors.textMuted }]}>OPEN TASKS</Text>
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          {tasks.slice(0, 3).map((task) => (
            <TaskRow key={task.id} task={task} onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })} />
          ))}
          {tasks.length === 0 ? <Text style={{ color: colors.textMuted }}>No open tasks for this goal.</Text> : null}
        </View>
      </Card>
      <Modal visible={modalOpen} onDismiss={() => setModalOpen(false)} title="New task">
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          placeholder="Task title"
          placeholderTextColor={colors.textMuted}
          value={taskTitle}
          onChangeText={setTaskTitle}
        />
        <Button title="Create task" onPress={submitTask} loading={createTask.isPending} />
      </Modal>
    </FixedScreen>
  );
}

const styles = StyleSheet.create({
  summary: { fontSize: 14, marginTop: 8 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
});
