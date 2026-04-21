import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useTheme } from '../theme';
import { Screen, AppHeader, Card, Chip } from '../components';
import { useCurrentResolution, useWeek1Tasks } from '../hooks/queries';
import { useCompleteTaskById, useSkipTaskById } from '../hooks/mutations';
import type { PlanStackScreenProps } from '../navigation/types';

export function WeeklyPlanScreen({ navigation, route }: PlanStackScreenProps<'WeeklyPlan'>) {
  const { colors, spacing } = useTheme();
  const resolutionId = route.params?.resolutionId ?? '';
  const { data: resolution } = useCurrentResolution();
  const { data: tasks } = useWeek1Tasks(resolutionId);
  const completeTask = useCompleteTaskById();
  const skipTask = useSkipTaskById();

  return (
    <Screen>
      <AppHeader title="Next Week Blueprint" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={[{ color: colors.text, fontWeight: '600', fontSize: 16 }]}>{resolution?.title ?? 'Loading…'}</Text>
          <View style={styles.metaRow}>
            <Chip label={resolution?.week_1_plan_status ?? ''} variant="default" />
          </View>
        </Card>

        <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: spacing.sm }]}>Suggested actions</Text>
        {tasks?.map((task) => (
          <Card key={task.id} style={{ marginBottom: spacing.sm }}>
            <View style={styles.taskRow}>
              <Pressable
                testID={`task-complete-${task.id}`}
                onPress={() => {
                  if (task.status === 'completed') return;
                  completeTask.mutate(task.id);
                }}
                style={[
                  styles.checkbox,
                  { borderColor: colors.border, backgroundColor: task.status === 'completed' ? colors.indigo : 'transparent' },
                ]}
              >
                {task.status === 'completed' ? <Text style={{ color: colors.white, fontSize: 12, fontWeight: '700' }}>✓</Text> : null}
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={[{ color: colors.text, textDecorationLine: task.status === 'skipped' ? 'line-through' : 'none' }]}>{task.title}</Text>
                {task.metadata_json && (
                  <Text style={[{ color: colors.textMuted, fontSize: 12 }]}>
                    {String((task.metadata_json as { duration_minutes?: number }).duration_minutes ?? 10)}min ·{' '}
                    {String((task.metadata_json as { time_of_day?: string }).time_of_day ?? 'morning')}
                  </Text>
                )}
              </View>
              {task.status === 'open' && (
                <Pressable
                  onPress={() =>
                    Alert.alert('Skip task?', 'You can still see it in history depending on plan settings.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Skip', style: 'destructive', onPress: () => skipTask.mutate(task.id) },
                    ])
                  }
                >
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>Skip</Text>
                </Pressable>
              )}
            </View>
          </Card>
        ))}

        <View style={styles.bottomRow}>
          <Pressable testID="btn-history" onPress={() => navigation.push('PlanHistory', { resolutionId })}>
            <Text style={[{ color: colors.indigo }]}>History</Text>
          </Pressable>
          <Pressable testID="btn-update-plan" onPress={() => navigation.push('PlanReview', { resolutionId })}>
            <Text style={[{ color: colors.indigo }]}>Update plan</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  metaRow: { flexDirection: 'row', marginTop: 8 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
});
