import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { useTheme } from '../theme';
import { Screen, Card, SegmentedToggle, ProgressRing, Button, Modal } from '../components';
import { useDashboard, useJourneyDaily, useMe } from '../hooks/queries';
import { useUIStore } from '../state/uiStore';
import { useCreateResolution, useCreateTask } from '../hooks/mutations';
import type { HomeStackScreenProps } from '../navigation/types';

export function HomeScreen({ navigation }: HomeStackScreenProps<'Home'>) {
  const { colors, spacing, typography } = useTheme();
  const { personalWorkIndex, setPersonalWorkIndex } = useUIStore();
  const [fabOpen, setFabOpen] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDetail, setGoalDetail] = useState('');
  const createTask = useCreateTask();
  const createResolution = useCreateResolution();
  const { data: dashboard } = useDashboard();
  const { data: me } = useMe();
  const { data: journey } = useJourneyDaily();

  const totalTasks = (dashboard?.resolution?.open_tasks ?? 0) + (dashboard?.resolution?.completed_tasks ?? 0);
  const completedTasks = dashboard?.resolution?.completed_tasks ?? 0;
  const progress = totalTasks > 0 ? completedTasks / totalTasks : 0;
  const openCount = dashboard?.resolution?.open_tasks ?? 0;

  const openTasks = journey?.tasks?.filter((t) => t.status === 'open') ?? [];
  const nextTask = openTasks[0];
  const creatingTask = createTask.isPending;
  const creatingGoal = createResolution.isPending;

  const closeFabMenu = () => setFabOpen(false);

  const handleCreateTask = async () => {
    const title = taskTitle.trim();
    if (!title) return;
    try {
      await createTask.mutateAsync({ title });
      setTaskTitle('');
      setShowTaskModal(false);
    } catch (error) {
      Alert.alert('Could not add task', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const handleCreateGoal = async () => {
    const title = goalTitle.trim();
    if (!title) return;
    try {
      const created = await createResolution.mutateAsync({
        title,
        detail: goalDetail.trim() || undefined,
      });
      setGoalTitle('');
      setGoalDetail('');
      setShowGoalModal(false);
      navigation
        .getParent()
        ?.navigate('PlanTab', { screen: 'PlanReview', params: { resolutionId: created.id } });
    } catch (error) {
      Alert.alert('Could not add goal', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dateLine = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
        <View style={{ marginBottom: spacing.md }}>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>
            {greeting}, {me?.email ? me.email.split('@')[0] : 'there'}
          </Text>
          <Text style={[{ color: colors.textSecondary, marginTop: spacing.xs }]}>{dateLine}</Text>
          <Text style={[{ color: colors.textMuted, marginTop: spacing.xs, fontSize: 13 }]}>We shaped today so you can stay present.</Text>
        </View>

        <SegmentedToggle options={['Personal', 'Work']} selected={personalWorkIndex} onChange={setPersonalWorkIndex} />

        <View style={[styles.statsRow, { marginTop: spacing.lg, gap: spacing.sm }]}>
          <Card style={styles.statCard}>
            <Text style={[styles.statNum, { color: colors.indigo }]}>{openCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Remaining</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statNum, { color: colors.success }]}>{completedTasks}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Completed</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statNum, { color: colors.warning }]}>—</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Focus</Text>
          </Card>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: spacing.lg }]}>Quick actions</Text>
        <View style={[styles.quickGrid, { marginTop: spacing.sm, gap: spacing.sm }]}>
          <Pressable style={styles.quickHalf} onPress={() => navigation.getParent()?.navigate('PlanTab', { screen: 'WeeklyPlan', params: { resolutionId: '' } })}>
            <Card style={styles.quickCard}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>Next week blueprint</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>Plan ahead</Text>
            </Card>
          </Pressable>
          <Pressable style={styles.quickHalf} onPress={() => navigation.getParent()?.navigate('PlanTab', { screen: 'Dashboard' })}>
            <Card style={styles.quickCard}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>My week</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>View progress</Text>
            </Card>
          </Pressable>
          <Pressable style={styles.quickFull} onPress={() => navigation.getParent()?.navigate('InterventionsTab', { screen: 'Interventions' })}>
            <Card style={styles.quickCard}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>Coaching & interventions</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>Get personalized support</Text>
            </Card>
          </Pressable>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: spacing.lg }]}>Daily momentum</Text>
        <View style={[styles.momentumGrid, { marginTop: spacing.sm }]}>
          <View style={styles.momentumCol}>
            <ProgressRing progress={progress} size={100} />
            <Text style={{ color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }}>Tasks this week</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center' }}>
              {completedTasks} of {totalTasks || '—'}
            </Text>
          </View>
          <View style={styles.momentumCol}>
            <ProgressRing progress={0} size={100} />
            <Text style={{ color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }}>Focus time</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center' }}>Syncs with sessions</Text>
          </View>
        </View>

        {nextTask && (
          <Card style={{ marginTop: spacing.lg, backgroundColor: colors.indigoLight }}>
            <Text style={{ fontSize: 11, color: colors.textMuted, letterSpacing: 1 }}>UP NEXT</Text>
            <Text style={[typography.title, { color: colors.text, marginTop: 4 }]}>{nextTask.title}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
              {personalWorkIndex === 0 ? 'Personal' : 'Work'}
            </Text>
            <Button
              title="Enter Focus Mode"
              variant="primary"
              onPress={() =>
                navigation.navigate('FocusMode', {
                  taskId: nextTask.id,
                  taskTitle: nextTask.title,
                })
              }
              style={{ marginTop: spacing.md }}
            />
          </Card>
        )}

        {fabOpen ? <Pressable style={styles.fabBackdrop} onPress={closeFabMenu} /> : null}
        {fabOpen ? (
          <View style={styles.fabMenu}>
            <Pressable
              testID="home-add-task-fab"
              style={[styles.fabOption, { backgroundColor: colors.success }]}
              onPress={() => {
                closeFabMenu();
                setShowTaskModal(true);
              }}
            >
              <Text style={styles.fabOptionText}>New Task</Text>
            </Pressable>
            <Pressable
              testID="home-add-goal-fab"
              style={[styles.fabOption, { backgroundColor: colors.warning }]}
              onPress={() => {
                closeFabMenu();
                setShowGoalModal(true);
              }}
            >
              <Text style={styles.fabOptionText}>New Goal</Text>
            </Pressable>
            <Pressable
              testID="home-braindump-fab"
              style={[styles.fabOption, { backgroundColor: colors.indigo }]}
              onPress={() => {
                closeFabMenu();
                navigation.navigate('BrainDumpModal', {});
              }}
            >
              <Text style={styles.fabOptionText}>Brain Dump</Text>
            </Pressable>
          </View>
        ) : null}
        <Pressable testID="home-fab" onPress={() => setFabOpen((v) => !v)} style={[styles.fab, { backgroundColor: colors.indigo }]}>
          <Text style={{ color: colors.white, fontSize: 24 }}>{fabOpen ? '×' : '+'}</Text>
        </Pressable>
      </ScrollView>
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
        <Button title="Create task" onPress={handleCreateTask} loading={creatingTask} />
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
          multiline
          value={goalDetail}
          onChangeText={setGoalDetail}
        />
        <Button title="Create goal" onPress={handleCreateGoal} loading={creatingGoal} />
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row' },
  statCard: { flex: 1, alignItems: 'center', minWidth: 0 },
  statNum: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 4, textAlign: 'center' },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  quickHalf: { width: '48%', flexGrow: 1 },
  quickFull: { width: '100%' },
  quickCard: { minHeight: 88 },
  momentumGrid: { flexDirection: 'row', gap: 16, justifyContent: 'space-around' },
  momentumCol: { alignItems: 'center', flex: 1 },
  fabBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  fabMenu: {
    position: 'absolute',
    right: 12,
    bottom: 76,
    alignItems: 'flex-end',
    gap: 8,
  },
  fabOption: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  fabOptionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  creatorInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  creatorMultiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
});
