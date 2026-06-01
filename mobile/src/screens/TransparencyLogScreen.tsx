import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { AppHeader, Card, FixedScreen, PaginationFooter } from '../components';
import { useTransparency } from '../hooks/queries';
import type { ActivityStackScreenProps } from '../navigation/types';
import { useTheme } from '../theme';

export function TransparencyLogScreen({ navigation }: ActivityStackScreenProps<'TransparencyLog'>) {
  const { colors, spacing } = useTheme();
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursorStack[cursorStack.length - 1];
  const { data } = useTransparency({ cursor, limit: 5 });
  const items = data?.items ?? [];
  const hasNext = Boolean(data?.next_cursor);

  return (
    <FixedScreen
      header={<AppHeader title="Transparency" onBack={() => navigation.goBack()} />}
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
        {items.map((item) => (
          <Card key={item.id} padding="sm">
            <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '700' }}>{item.headline}</Text>
            {item.detail ? <Text numberOfLines={2} style={{ color: colors.textSecondary, fontSize: 13 }}>{item.detail}</Text> : null}
            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
              {item.action_type} · {new Date(item.created_at).toLocaleString()}
            </Text>
          </Card>
        ))}
        {items.length === 0 ? <Text style={{ color: colors.textMuted }}>No log entries yet.</Text> : null}
      </View>
    </FixedScreen>
  );
}
