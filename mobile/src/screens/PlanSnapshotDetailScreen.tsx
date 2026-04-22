import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { useTheme } from '../theme';
import { Screen, AppHeader, Card } from '../components';
import { usePlanSnapshot } from '../hooks/queries';
import type { PlanStackScreenProps } from '../navigation/types';

export function PlanSnapshotDetailScreen({ navigation, route }: PlanStackScreenProps<'PlanSnapshotDetail'>) {
  const { colors, spacing } = useTheme();
  const snapshotId = route.params.snapshotId;
  const { data: snap, isPending } = usePlanSnapshot(snapshotId);

  return (
    <Screen>
      <AppHeader title="Plan snapshot" onBack={() => navigation.goBack()} />
      <FlatList
        data={snap?.tasks ?? []}
        keyExtractor={(_, i) => `${snapshotId}-${i}`}
        ListHeaderComponent={
          <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
            {isPending ? (
              <Text style={{ color: colors.textMuted }}>Loading…</Text>
            ) : snap ? (
              <Card style={{ marginBottom: spacing.sm }}>
                <Text style={[{ color: colors.text, fontWeight: '600' }]}>
                  {snap.kind} · {snap.planner_version}
                </Text>
                <Text style={[{ color: colors.textMuted, fontSize: 12, marginTop: 4 }]}>
                  {new Date(snap.created_at).toLocaleString()}
                </Text>
              </Card>
            ) : (
              <Text style={{ color: colors.textMuted }}>Snapshot not found.</Text>
            )}
          </View>
        }
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: spacing.sm }}>
            <Text style={[{ color: colors.text }]}>{item.title}</Text>
            <Text style={[{ color: colors.textMuted, fontSize: 12, marginTop: 4 }]}>Order {item.sort_order}</Text>
          </Card>
        )}
        ListEmptyComponent={
          !isPending && snap && snap.tasks.length === 0 ? (
            <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg }}>No tasks in snapshot.</Text>
          ) : null
        }
      />
    </Screen>
  );
}
