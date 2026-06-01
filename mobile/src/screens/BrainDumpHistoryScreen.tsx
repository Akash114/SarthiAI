import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AppHeader, Card, FixedScreen, PaginationFooter } from '../components';
import { useBrainDumps } from '../hooks/queries';
import type { SettingsStackScreenProps } from '../navigation/types';
import { useTheme } from '../theme';

export function BrainDumpHistoryScreen({ navigation }: SettingsStackScreenProps<'BrainDumpHistory'>) {
  const { colors, spacing } = useTheme();
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursorStack[cursorStack.length - 1];
  const { data, isPending } = useBrainDumps({ cursor, limit: 5 });
  const items = data?.items ?? [];
  const hasNext = Boolean(data?.next_cursor);

  return (
    <FixedScreen
      header={<AppHeader title="Brain Dumps" onBack={() => navigation.goBack()} />}
      footer={
        <PaginationFooter
          page={cursorStack.length}
          hasPrevious={cursorStack.length > 1}
          hasNext={hasNext}
          onPrevious={() => setCursorStack((stack) => stack.slice(0, -1))}
          onNext={() => {
            if (data?.next_cursor) setCursorStack((stack) => [...stack, data.next_cursor ?? undefined]);
          }}
        />
      }
    >
      <View style={{ flex: 1, gap: spacing.sm }}>
        {isPending ? <Text style={{ color: colors.textMuted }}>Loading...</Text> : null}
        {items.map((item) => (
          <Pressable key={item.id} onPress={() => navigation.navigate('BrainDumpDetail', { dumpId: item.id })}>
            <Card padding="sm">
              <Text numberOfLines={2} style={{ color: colors.text }}>{item.excerpt}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6 }}>
                {new Date(item.created_at).toLocaleString()} · {item.processing_status}
              </Text>
            </Card>
          </Pressable>
        ))}
        {!isPending && items.length === 0 ? <Text style={{ color: colors.textMuted }}>No brain dumps yet.</Text> : null}
      </View>
    </FixedScreen>
  );
}
