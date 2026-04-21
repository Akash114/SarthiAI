import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useTheme } from '../theme';
import { Screen, AppHeader, Card, Chip } from '../components';
import { useCurrentResolution, useWeek1Tasks } from '../hooks/queries';
import { useCompleteTask } from '../hooks/mutations';
import type { PlanStackScreenProps } from '../navigation/types';

export function WeeklyPlanScreen({ navigation, route }: PlanStackScreenProps<'WeeklyPlan'>) {
  const { colors, spacing } = useTheme();
  const resolutionId = route.params?.resolutionId ?? '';
  const { data: resolution } = useCurrentResolution();
  const { data: tasks } = useWeek1Tasks(resolutionId);

  return (
    <Screen>
      <AppHeader title="Next Week Blueprint" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {/* Top card */}
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={[{ color: colors.text, fontWeight: '600', fontSize: 16 }]}>
            {resolution?.title ?? 'Loading…'}
          </Text>
          <View style={styles.metaRow}>
            <Chip label={resolution?.week_1_plan_status ?? ''} variant="default" />
          </View>
        </Card>

        {/* Suggested Actions */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: spacing.sm }]}>Suggested Actions</Text>
        {tasks?.map((task) => (
          <Card key={task.id} style={{ marginBottom: spacing.sm }}>
            <View style={styles.taskRow}>
              <Pressable
                testID={`task-complete-${task.id}`}
                onPress={() => useCompleteTask(task.id).mutate()}
                style={[styles.checkbox, { borderColor: colors.border }]}
              />
              <View style={{ flex: 1 }}>
                <Text style={[{ color: colors.text }]}>{task.title}</Text>
                {task.metadata_json && (
                  <Text style={[{ color: colors.textMuted, fontSize: 12 }]}>
                    {String(task.metadata_json.duration_minutes ?? 10)}min ·{' '}
                    {String(task.metadata_json.time_of_day ?? 'morning')}
                  </Text>
                )}
              </View>
            </View>
          </Card>
        ))}

        {/* Bottom nav */}
        <View style={styles.bottomRow}>
          <Pressable testID="btn-history" onPress={() => navigation.push('PlanHistory', { resolutionId })}>
            <Text style={[{ color: colors.indigo }]}>History</Text>
          </Pressable>
          <Pressable testID="btn-update-plan" onPress={() => navigation.push('PlanReview', { resolutionId })}>
            <Text style={[{ color: colors.indigo }]}>Update Plan</Text>
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
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
});
