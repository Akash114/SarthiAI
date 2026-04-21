import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useTheme } from '../theme';
import { Screen, AppHeader, Card } from '../components';
import { useInterventionHistory } from '../hooks/queries';
import type { InterventionsStackScreenProps } from '../navigation/types';

export function InterventionsHistoryScreen({ navigation }: InterventionsStackScreenProps<'InterventionsHistory'>) {
  const { colors, spacing } = useTheme();
  const { data: history } = useInterventionHistory();

  return (
    <Screen>
      <AppHeader title="Intervention History" onBack={() => navigation.goBack()} />
      <FlatList
        data={history ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg }}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: spacing.sm }}>
            <Text style={[{ color: colors.text }]}>{item.summary}</Text>
            <Text style={[{ color: colors.textMuted, fontSize: 12, marginTop: 4 }]}>
              {item.status} · {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
            </Text>
          </Card>
        )}
        ListEmptyComponent={
          <Text style={[{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
            No past interventions.
          </Text>
        }
      />
    </Screen>
  );
}
