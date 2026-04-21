import React from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useTheme } from '../theme';
import { Screen, AppHeader, Card } from '../components';
import { usePlanHistory, usePlanSnapshot } from '../hooks/queries';
import type { PlanStackScreenProps } from '../navigation/types';

export function PlanHistoryScreen({ navigation, route }: PlanStackScreenProps<'PlanHistory'>) {
  const { colors, spacing } = useTheme();
  const resolutionId = route.params?.resolutionId ?? '';
  const { data: history } = usePlanHistory(resolutionId);

  return (
    <Screen>
      <AppHeader title="Plan History" onBack={() => navigation.goBack()} />
      <FlatList
        data={history?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg }}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: spacing.sm }}>
            <Text style={[{ color: colors.text }]}>
              {item.kind} · v{item.planner_version}
            </Text>
            <Text style={[{ color: colors.textMuted, fontSize: 12, marginTop: 4 }]}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </Card>
        )}
        ListEmptyComponent={
          <Text style={[{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
            No plan history yet.
          </Text>
        }
      />
    </Screen>
  );
}
