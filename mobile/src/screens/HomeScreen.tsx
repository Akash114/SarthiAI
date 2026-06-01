import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, FixedScreen, GoalCard, Modal, TaskRow } from '../components';
import { useActiveFocusSession, useGoals, useMe, useNotifications, useTasks } from '../hooks/queries';
import { useCreateGoal, useCreateTask } from '../hooks/mutations';
import type { HomeStackScreenProps } from '../navigation/types';
import { useTheme } from '../theme';

export function HomeScreen({ navigation }: HomeStackScreenProps<'Home'>) {
  const { colors, spacing, typography } = useTheme();
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDetail, setGoalDetail] = useState('');
  const createTask = useCreateTask();
  const createGoal = useCreateGoal();
  const { data: me } = useMe();
  const { data: taskPage } = useTasks({ status: 'open' });
  const { data: goalPage } = useGoals({ status: 'active' });
  const { data: notifications } = useNotifications(5);
  const { data: activeFocus } = useActiveFocusSession();

  const tasks = taskPage?.tasks ?? [];
  const nextTask = tasks[0];
  const activeGoal = goalPage?.goals?.[0];
  const nudge = notifications?.notifications?.[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dateLine = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const handleCreateTask = async () => {
    const title = taskTitle.trim();
    if (!title) return;
    try {
      await createTask.mutateAsync({ title });
      setTaskTitle('');
      setShowTaskModal(false);
    } catch (e) {
      Alert.alert('Could not add task', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const handleCreateGoal = async () => {
    const title = goalTitle.trim();
    if (!title) return;
    try {
      const goal = await createGoal.mutateAsync({
        title,
        description: goalDetail.trim() || undefined,
      });
      setGoalTitle('');
      setGoalDetail('');
      setShowGoalModal(false);
      navigation.getParent()?.navigate('GoalsTab', { screen: 'GoalDetail', params: { goalId: goal.id } });
    } catch (e) {
      Alert.alert('Could not add goal', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  return (
    <FixedScreen
      testID="home-root"
      footer={
        <View style={[styles.footerGrid, { gap: spacing.sm }]}>
          <Button title="Task" size="sm" onPress={() => setShowTaskModal(true)} style={styles.footerButton} />
          <Button title="Goal" size="sm" variant="ghost" onPress={() => setShowGoalModal(true)} style={styles.footerButton} />
          <Button title="Dump" size="sm" variant="ghost" onPress={() => navigation.navigate('BrainDumpModal', {})} style={styles.footerButton} />
        </View>
      }
    >
      <View style={{ marginBottom: spacing.md }}>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>
          {greeting}, {me?.display_name || (me?.email ? me.email.split('@')[0] : 'there')}
        </Text>
        <Text style={{ color: colors.textSecondary, marginTop: spacing.xs }}>{dateLine}</Text>
      </View>

      {nudge ? (
        <Card style={{ backgroundColor: colors.indigoLight, marginBottom: spacing.md }}>
          <Text style={[styles.sectionLabel, { color: colors.indigoDark }]}>{nudge.kind.replace(/_/g, ' ').toUpperCase()}</Text>
          <Text numberOfLines={2} style={{ color: colors.text, marginTop: 4, fontWeight: '700' }}>
            {nudge.title}
          </Text>
          {nudge.body ? <Text numberOfLines={2} style={{ color: colors.textSecondary, marginTop: 4 }}>{nudge.body}</Text> : null}
        </Card>
      ) : null}

      {activeGoal ? (
        <GoalCard
          goal={activeGoal}
          onPress={() => navigation.getParent()?.navigate('GoalsTab', { screen: 'GoalDetail', params: { goalId: activeGoal.id } })}
        />
      ) : (
        <Card>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>NO ACTIVE GOAL</Text>
          <Text style={{ color: colors.text, marginTop: 4 }}>Create one clear direction for the week.</Text>
        </Card>
      )}

      <View style={[styles.taskBlock, { gap: spacing.sm, marginTop: spacing.md }]}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>NEXT TASKS</Text>
        {tasks.slice(0, 3).map((task) => (
          <TaskRow key={task.id} task={task} onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })} />
        ))}
        {tasks.length === 0 ? <Text style={{ color: colors.textMuted }}>No open tasks. Capture one or start with a brain dump.</Text> : null}
      </View>

      <Card style={{ marginTop: spacing.md }}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>FOCUS</Text>
        <Text numberOfLines={1} style={[typography.title, { color: colors.text, marginTop: 4 }]}>
          {activeFocus ? 'Focus session running' : nextTask?.title ?? 'Open-ended focus'}
        </Text>
        <Button
          title={activeFocus ? 'Return to focus' : 'Start focus'}
          onPress={() => navigation.navigate('FocusMode', { taskId: nextTask?.id, taskTitle: nextTask?.title })}
          style={{ marginTop: spacing.sm }}
        />
      </Card>

      <Modal visible={showTaskModal} onDismiss={() => setShowTaskModal(false)} title="Add task">
        <TextInput
          testID="task-title-input"
          style={[styles.creatorInput, { borderColor: colors.border, color: colors.text }]}
          placeholder="Task title"
          placeholderTextColor={colors.textMuted}
          value={taskTitle}
          onChangeText={setTaskTitle}
          autoFocus
        />
        <Button title="Create task" onPress={handleCreateTask} loading={createTask.isPending} />
      </Modal>

      <Modal visible={showGoalModal} onDismiss={() => setShowGoalModal(false)} title="Add goal">
        <TextInput
          testID="goal-title-input"
          style={[styles.creatorInput, { borderColor: colors.border, color: colors.text }]}
          placeholder="Goal title"
          placeholderTextColor={colors.textMuted}
          value={goalTitle}
          onChangeText={setGoalTitle}
          autoFocus
        />
        <TextInput
          testID="goal-detail-input"
          style={[styles.creatorInput, styles.creatorMultiline, { borderColor: colors.border, color: colors.text }]}
          placeholder="Optional details"
          placeholderTextColor={colors.textMuted}
          value={goalDetail}
          onChangeText={setGoalDetail}
          multiline
        />
        <Button title="Create goal" onPress={handleCreateGoal} loading={createGoal.isPending} />
      </Modal>
    </FixedScreen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { fontSize: 11, letterSpacing: 1, fontWeight: '700' },
  taskBlock: { flex: 1 },
  footerGrid: { flexDirection: 'row' },
  footerButton: { flex: 1 },
  creatorInput: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  creatorMultiline: { minHeight: 90, textAlignVertical: 'top' },
});
