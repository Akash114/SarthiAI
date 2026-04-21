import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useTheme } from '../theme';
import { Screen, AppHeader, Card, Chip } from '../components';
import { useCurrentIntervention, useDashboard, useWeek1Tasks } from '../hooks/queries';
import { useApproveIntervention, useDismissIntervention } from '../hooks/mutations';
import type { InterventionsStackScreenProps } from '../navigation/types';

export function InterventionsScreen({ navigation }: InterventionsStackScreenProps<'Interventions'>) {
  const { colors, spacing } = useTheme();
  const { data: intervention } = useCurrentIntervention();
  const { data: dashboard } = useDashboard();

  const approveMutation = useApproveIntervention(intervention?.id ?? '');
  const dismissMutation = useDismissIntervention(intervention?.id ?? '');

  return (
    <Screen>
      <AppHeader
        title="Interventions"
        right={
          <Pressable onPress={() => navigation.push('InterventionsHistory')}>
            <Text style={[{ color: colors.indigo }]}>History</Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {/* Slippage detected banner */}
        {dashboard?.pending_intervention && (
          <Card style={{ backgroundColor: colors.warningLight, marginBottom: spacing.lg }}>
            <Text style={[{ color: colors.warning, fontWeight: '600' }]}>Slippage detected</Text>
            <Text style={[{ color: colors.warning, marginTop: 4 }]}>
              Some tasks are running behind schedule.
            </Text>
          </Card>
        )}

        {/* Agent Suggestion */}
        <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: spacing.sm }]}>
          Agent Suggestion
        </Text>
        {intervention ? (
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={[{ color: colors.text }]}>{intervention.summary}</Text>
            {(() => {
              const extra = intervention.detail_json as { body?: string; bullets?: string[] } | null | undefined;
              if (!extra) return null;
              if (extra.body) {
                return (
                  <Text style={[{ color: colors.textSecondary, marginTop: spacing.sm, fontSize: 14 }]}>{extra.body}</Text>
                );
              }
              if (Array.isArray(extra.bullets) && extra.bullets.length > 0) {
                return (
                  <View style={{ marginTop: spacing.sm }}>
                    {extra.bullets.map((b) => (
                      <Text key={b} style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 4 }}>
                        • {b}
                      </Text>
                    ))}
                  </View>
                );
              }
              return null;
            })()}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: spacing.md }}>
              <Pressable
                testID="btn-approve-intervention"
                onPress={() => approveMutation.mutate()}
                style={[styles.actionBtn, { backgroundColor: colors.indigo }]}
              >
                <Text style={[{ color: colors.white, fontWeight: '600' }]}>Try this</Text>
              </Pressable>
              <Pressable
                testID="btn-dismiss-intervention"
                onPress={() => dismissMutation.mutate()}
                style={[styles.actionBtn, { borderColor: colors.border, borderWidth: 1 }]}
              >
                <Text style={[{ color: colors.text }]}>Dismiss</Text>
              </Pressable>
            </View>
          </Card>
        ) : (
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={[{ color: colors.textMuted }]}>No intervention pending. Check back after your daily review.</Text>
          </Card>
        )}

        {/* Fallback static suggestions (shown in __DEV__ or when backend only provides one) */}
        {__DEV__ && (
          <>
            <Card style={{ marginBottom: spacing.sm }}>
              <Text style={[{ color: colors.text, fontWeight: '600' }]}>Refine Your Goals</Text>
              <Text style={[{ color: colors.textSecondary, fontSize: 13 }]}>
                Consider updating your resolution to better match your capacity.
              </Text>
            </Card>
            <Card>
              <Text style={[{ color: colors.text, fontWeight: '600' }]}>Take a Break</Text>
              <Text style={[{ color: colors.textSecondary, fontSize: 13 }]}>
                Rest is part of the plan. Schedule a short break before your next task block.
              </Text>
            </Card>
          </>
        )}

        {/* Transparency log link */}
        <Pressable testID="btn-transparency-log" onPress={() => navigation.push('TransparencyLog')}>
          <Text style={[{ color: colors.indigo, marginTop: spacing.lg }]}>View Transparency Log</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
});
