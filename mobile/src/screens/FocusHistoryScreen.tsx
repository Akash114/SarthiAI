import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { AppHeader, Card, FixedScreen, PaginationFooter } from '../components';
import { useFocusSessions } from '../hooks/queries';
import type { SettingsStackScreenProps } from '../navigation/types';
import { useTheme } from '../theme';

export function FocusHistoryScreen({ navigation }: SettingsStackScreenProps<'FocusHistory'>) {
  const { colors, spacing } = useTheme();
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursorStack[cursorStack.length - 1];
  const { data, isLoading } = useFocusSessions({ cursor, limit: 5 });
  const items = data?.items ?? [];
  const hasNext = Boolean(data?.next_cursor);

  return (
    <FixedScreen
      header={<AppHeader title="Focus history" onBack={() => navigation.goBack()} />}
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
        {isLoading ? <Text style={{ color: colors.textMuted }}>Loading sessions...</Text> : null}
        {!isLoading && items.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>No focus sessions yet. Start one from Home.</Text>
        ) : null}
        {items.map((session) => (
          <Card key={session.id} padding="sm">
            <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '700' }}>
              {session.task_title ?? 'Open-ended focus'}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>
              {Math.max(1, Math.round(session.elapsed_seconds / 60))} min
              {session.ended_at ? '' : ' · active'}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
              {new Date(session.started_at).toLocaleString()}
            </Text>
          </Card>
        ))}
      </View>
    </FixedScreen>
  );
}
