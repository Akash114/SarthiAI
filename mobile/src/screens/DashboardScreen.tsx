import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useTheme } from '../theme';
import { Screen, AppHeader, Card, ProgressBar, Chip, Button } from '../components';
import { useDashboard } from '../hooks/queries';

export function DashboardScreen() {
  const { colors, spacing, typography } = useTheme();
  const { data: dashboard } = useDashboard();
  const res = dashboard?.resolution;

  const skipped = res?.skipped_tasks ?? 0;
  const total = (res?.open_tasks ?? 0) + (res?.completed_tasks ?? 0) + skipped;
  const progress = total > 0 ? (res?.completed_tasks ?? 0) / total : 0;

  return (
    <Screen>
      <AppHeader title="Weekly Overview" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {/* Top progress card */}
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={[styles.overline, { color: colors.textMuted }]}>WEEKLY OVERVIEW</Text>
          <View style={styles.progressRow}>
            <Text style={[styles.progressNum, { color: colors.text }]}>
              {res?.completed_tasks ?? 0}/{total}
            </Text>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <ProgressBar progress={progress} height={10} />
            </View>
          </View>
        </Card>

        {/* Focus areas */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: spacing.sm }]}>Focus Areas</Text>
        {res ? (
          <Card style={{ marginBottom: spacing.sm }}>
            <Text style={[{ color: colors.text, fontWeight: '600' }]}>{res.title}</Text>
            <View style={styles.metaRow}>
              <Chip
                label={res.week_1_plan_status}
                variant={res.week_1_plan_status === 'ready' ? 'default' : 'needsFocus'}
              />
              <Text style={[{ color: colors.textMuted, fontSize: 12, marginLeft: spacing.xs }]}>
                {res.open_tasks} open · {res.completed_tasks} done
                {skipped > 0 ? ` · ${skipped} skipped` : ''}
              </Text>
            </View>
          </Card>
        ) : (
          <Card style={{ marginBottom: spacing.sm }}>
            <Text style={[{ color: colors.textSecondary }]}>
              One active goal at a time — complete or end the current one to start another.
            </Text>
          </Card>
        )}

        {/* Needs Focus chip */}
        {(dashboard?.pending_intervention || res?.week_1_plan_status !== 'ready') && (
          <Chip label="Needs Focus" variant="needsFocus" style={{ alignSelf: 'flex-start', marginTop: spacing.xs }} />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  overline: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  progressRow: { flexDirection: 'row', alignItems: 'center' },
  progressNum: { fontSize: 32, fontWeight: '700' },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
});
