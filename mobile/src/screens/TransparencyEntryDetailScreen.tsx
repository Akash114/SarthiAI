import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTheme } from '../theme';
import { Screen, AppHeader, Card } from '../components';
import { useTransparencyEntry } from '../hooks/queries';
import type { InterventionsStackScreenProps } from '../navigation/types';

export function TransparencyEntryDetailScreen({
  navigation,
  route,
}: InterventionsStackScreenProps<'TransparencyEntry'>) {
  const { colors, spacing } = useTheme();
  const entryId = route.params.entryId;
  const { data: entry, isPending } = useTransparencyEntry(entryId);

  return (
    <Screen>
      <AppHeader title="Log entry" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {isPending ? (
          <Text style={{ color: colors.textMuted }}>Loading…</Text>
        ) : entry ? (
          <Card>
            <Text style={[{ color: colors.text, fontWeight: '700', fontSize: 18 }]}>{entry.headline}</Text>
            {entry.detail ? (
              <Text style={[{ color: colors.textSecondary, marginTop: spacing.sm }]}>{entry.detail}</Text>
            ) : null}
            <Text style={[{ color: colors.textMuted, fontSize: 12, marginTop: spacing.md }]}>
              {entry.action_type} · {new Date(entry.created_at).toLocaleString()}
            </Text>
          </Card>
        ) : (
          <Text style={{ color: colors.textMuted }}>Entry not found.</Text>
        )}
      </ScrollView>
    </Screen>
  );
}
