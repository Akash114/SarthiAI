import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useTheme } from '../theme';
import { Screen, AppHeader, Card, SegmentedToggle, ProgressRing, Chip, Button } from '../components';
import { useDashboard, useJourneyDaily, useCurrentResolution } from '../hooks/queries';
import { useUIStore } from '../state/uiStore';
import type { HomeStackScreenProps } from '../navigation/types';

export function HomeScreen({ navigation }: HomeStackScreenProps<'Home'>) {
  const { colors, spacing, typography } = useTheme();
  const { personalWorkIndex, setPersonalWorkIndex } = useUIStore();
  const { data: dashboard } = useDashboard();
  const { data: resolution } = useCurrentResolution();
  const { data: journey } = useJourneyDaily();

  const totalTasks = (dashboard?.resolution?.open_tasks ?? 0) + (dashboard?.resolution?.completed_tasks ?? 0);
  const completedTasks = dashboard?.resolution?.completed_tasks ?? 0;
  const progress = totalTasks > 0 ? completedTasks / totalTasks : 0;

  const openTasks = journey?.tasks?.filter((t) => t.status === 'open') ?? [];
  const nextTask = openTasks[0];

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[typography.display, { color: colors.text }]}>Sarthi AI</Text>
          <Text style={[{ color: colors.textSecondary, marginTop: spacing.xxs }]}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
        </View>

        {/* Personal / Work toggle */}
        <SegmentedToggle
          options={['Personal', 'Work']}
          selected={personalWorkIndex}
          onChange={setPersonalWorkIndex}
        />

        {/* Stats row */}
        <View style={[styles.statsRow, { marginTop: spacing.lg }]}>
          <Card style={styles.statCard}>
            <Text style={[styles.statNum, { color: colors.indigo }]}>{dashboard?.resolution?.open_tasks ?? 0}</Text>
            <Text style={[{ color: colors.textSecondary }]}>Remaining</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statNum, { color: colors.success }]}>{completedTasks}</Text>
            <Text style={[{ color: colors.textSecondary }]}>Completed</Text>
          </Card>
        </View>

        {/* Daily Momentum */}
        <Card style={{ marginTop: spacing.lg }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Daily Momentum</Text>
          <View style={styles.momentumRow}>
            <ProgressRing progress={progress} size={72} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={[{ color: colors.textSecondary }]}>
                {completedTasks} of {totalTasks} tasks this week
              </Text>
              <Chip label="Focus" variant={personalWorkIndex === 0 ? 'personal' : 'work'} style={{ marginTop: spacing.xs }} />
            </View>
          </View>
        </Card>

        {/* Up Next */}
        {nextTask && (
          <Card style={{ marginTop: spacing.md }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Up Next</Text>
            <Text style={[{ color: colors.text }]}>{nextTask.title}</Text>
            <Button
              title="Enter Focus Mode"
              variant="ghost"
              size="sm"
              onPress={() => {
                if (nextTask) {
                  navigation.navigate('FocusMode', {
                    taskId: nextTask.id,
                    taskTitle: nextTask.title,
                  });
                }
              }}
              style={{ marginTop: spacing.sm }}
            />
          </Card>
        )}

        {/* Quick nav tiles */}
        <View style={[styles.tilesRow, { marginTop: spacing.lg }]}>
          <Pressable style={{ flex: 1 }} onPress={() => navigation.getParent()?.navigate('PlanTab', { screen: 'WeeklyPlan', params: { resolutionId: '' } })}>
            <Card style={styles.tile}>
              <Text style={[{ color: colors.textSecondary, fontSize: 12 }]}>Next week blueprint</Text>
            </Card>
          </Pressable>
          <Pressable style={{ flex: 1 }} onPress={() => navigation.getParent()?.navigate('PlanTab', { screen: 'Dashboard' })}>
            <Card style={styles.tile}>
              <Text style={[{ color: colors.textSecondary, fontSize: 12 }]}>My week</Text>
            </Card>
          </Pressable>
          <Pressable style={{ flex: 1 }} onPress={() => navigation.getParent()?.navigate('InterventionsTab', { screen: 'Interventions' })}>
            <Card style={styles.tile}>
              <Text style={[{ color: colors.textSecondary, fontSize: 12 }]}>Coaching</Text>
            </Card>
          </Pressable>
        </View>

        {/* FAB */}
        <Pressable
          testID="home-braindump-fab"
          onPress={() => navigation.navigate('BrainDumpModal', {})}
          style={[styles.fab, { backgroundColor: colors.indigo }]}
        >
          <Text style={{ color: colors.white, fontSize: 24 }}>+</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 28, fontWeight: '700' },
  sectionTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  momentumRow: { flexDirection: 'row', alignItems: 'center' },
  tilesRow: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, minHeight: 64 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
