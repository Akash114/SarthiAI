import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useTheme } from '../theme';
import { Screen, Card, SegmentedToggle, ProgressRing, Button } from '../components';
import { useDashboard, useJourneyDaily, useMe } from '../hooks/queries';
import { useUIStore } from '../state/uiStore';
import type { HomeStackScreenProps } from '../navigation/types';

export function HomeScreen({ navigation }: HomeStackScreenProps<'Home'>) {
  const { colors, spacing, typography } = useTheme();
  const { personalWorkIndex, setPersonalWorkIndex } = useUIStore();
  const { data: dashboard } = useDashboard();
  const { data: me } = useMe();
  const { data: journey } = useJourneyDaily();

  const totalTasks = (dashboard?.resolution?.open_tasks ?? 0) + (dashboard?.resolution?.completed_tasks ?? 0);
  const completedTasks = dashboard?.resolution?.completed_tasks ?? 0;
  const progress = totalTasks > 0 ? completedTasks / totalTasks : 0;
  const openCount = dashboard?.resolution?.open_tasks ?? 0;

  const openTasks = journey?.tasks?.filter((t) => t.status === 'open') ?? [];
  const nextTask = openTasks[0];

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
});
