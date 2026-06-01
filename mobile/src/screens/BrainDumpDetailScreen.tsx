import React from 'react';
import { Text } from 'react-native';
import { AppHeader, Button, Card, FixedScreen } from '../components';
import { useBrainDumpDetail } from '../hooks/queries';
import type { SettingsStackScreenProps } from '../navigation/types';
import { useTheme } from '../theme';

export function BrainDumpDetailScreen({ navigation, route }: SettingsStackScreenProps<'BrainDumpDetail'>) {
  const { colors, spacing } = useTheme();
  const dumpId = route.params.dumpId;
  const { data, isPending } = useBrainDumpDetail(dumpId);

  return (
    <FixedScreen
      header={<AppHeader title="Brain Dump" onBack={() => navigation.goBack()} />}
      footer={data ? <Button title="Review proposals" onPress={() => navigation.push('BrainDumpReview', { dumpId: data.id })} /> : undefined}
    >
      {isPending ? <Text style={{ color: colors.textMuted }}>Loading...</Text> : null}
      {data ? (
        <>
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Captured</Text>
            <Text style={{ color: colors.textMuted, marginTop: 4 }}>{new Date(data.created_at).toLocaleString()}</Text>
            <Text style={{ color: colors.textMuted, marginTop: 8 }}>{data.processing_status}</Text>
          </Card>
          <Card style={{ flex: 1 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: spacing.xs }}>Text</Text>
            <Text numberOfLines={10} style={{ color: colors.text }}>{data.body}</Text>
          </Card>
        </>
      ) : null}
    </FixedScreen>
  );
}
