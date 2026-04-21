import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useTheme } from '../theme';
import { Screen, AppHeader, Card } from '../components';
import { useTransparencyLog } from '../hooks/queries';
import type { InterventionsStackScreenProps } from '../navigation/types';

export function TransparencyLogScreen({ navigation }: InterventionsStackScreenProps<'TransparencyLog'>) {
  const { colors, spacing } = useTheme();
  const { data: log } = useTransparencyLog({ limit: 50 });

  return (
    <Screen>
      <AppHeader title="Transparency Log" onBack={() => navigation.goBack()} />
      <FlatList
        data={log?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg }}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: spacing.sm }}>
            <Text style={[{ color: colors.text, fontWeight: '600' }]}>{item.headline}</Text>
            {item.detail && (
              <Text style={[{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }]}>{item.detail}</Text>
            )}
            <Text style={[{ color: colors.textMuted, fontSize: 11, marginTop: 4 }]}>
              {item.action_type} · {new Date(item.created_at).toLocaleString()}
            </Text>
          </Card>
        )}
        ListEmptyComponent={
          <Text style={[{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
            No log entries yet.
          </Text>
        }
      />
    </Screen>
  );
}
