import React from 'react';
import { Text, ScrollView } from 'react-native';
import { useTheme } from '../theme';
import { Screen, AppHeader, Card } from '../components';
import { useBrainDumpDetail } from '../hooks/queries';
import type { SettingsStackScreenProps } from '../navigation/types';

export function BrainDumpDetailScreen({ navigation, route }: SettingsStackScreenProps<'BrainDumpDetail'>) {
  const { colors, spacing } = useTheme();
  const dumpId = route.params.dumpId;
  const { data, isPending } = useBrainDumpDetail(dumpId);

  return (
    <Screen>
      <AppHeader title="Reflection" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {isPending ? (
          <Text style={{ color: colors.textMuted }}>Loading…</Text>
        ) : data ? (
          <>
            <Card style={{ marginBottom: spacing.md }}>
              <Text style={[{ color: colors.textSecondary, fontSize: 12 }]}>Captured</Text>
              <Text style={[{ color: colors.textMuted, marginTop: 4 }]}>{new Date(data.created_at).toLocaleString()}</Text>
              <Text style={[{ color: colors.textMuted, marginTop: 8 }]}>{data.actionable ? 'Marked actionable' : 'Not actionable'}</Text>
            </Card>
            <Card style={{ marginBottom: spacing.md }}>
              <Text style={[{ color: colors.textSecondary, fontSize: 12, marginBottom: spacing.xs }]}>Text</Text>
              <Text style={[{ color: colors.text }]}>{data.body}</Text>
            </Card>
            <Card>
              <Text style={[{ color: colors.textSecondary, fontSize: 12, marginBottom: spacing.xs }]}>Signals</Text>
              <Text style={[{ color: colors.textMuted, fontSize: 12 }]}>{JSON.stringify(data.signals, null, 2)}</Text>
            </Card>
          </>
        ) : (
          <Text style={{ color: colors.textMuted }}>Not found.</Text>
        )}
      </ScrollView>
    </Screen>
  );
}

