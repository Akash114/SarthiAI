import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { useTheme } from '../theme';
import { Screen, AppHeader, Card } from '../components';
import { useFocusSessions } from '../hooks/queries';
import type { HomeStackScreenProps, SettingsStackScreenProps } from '../navigation/types';

type FocusHistoryProps =
  | HomeStackScreenProps<'FocusHistory'>
  | SettingsStackScreenProps<'FocusHistory'>;

export function FocusHistoryScreen({ navigation }: FocusHistoryProps) {
  const { colors, spacing } = useTheme();
  const { data, isPending } = useFocusSessions(50);

  return (
    <Screen>
      <AppHeader title="Focus history" onBack={() => navigation.goBack()} />
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg }}
        ListEmptyComponent={
          isPending ? (
            <Text style={{ color: colors.textMuted }}>Loading…</Text>
          ) : (
            <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }}>No focus sessions yet.</Text>
          )
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: spacing.sm }}>
            <Text style={[{ color: colors.text, fontWeight: '600' }]}>
              {item.ended_at ? 'Completed session' : 'Open session'}
            </Text>
            <Text style={[{ color: colors.textMuted, fontSize: 12, marginTop: 4 }]}>
              Started {new Date(item.started_at).toLocaleString()}
              {item.ended_at ? ` · Ended ${new Date(item.ended_at).toLocaleString()}` : ''}
            </Text>
            {item.planned_seconds != null ? (
              <Text style={[{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }]}>
                Planned {item.planned_seconds}s
              </Text>
            ) : null}
          </Card>
        )}
      />
    </Screen>
  );
}
