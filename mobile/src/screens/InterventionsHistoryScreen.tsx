import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { AppHeader, Card, FixedScreen, PaginationFooter } from '../components';
import { useInterventions } from '../hooks/queries';
import type { ActivityStackScreenProps } from '../navigation/types';
import { useTheme } from '../theme';

const PAGE_SIZE = 5;

export function InterventionsHistoryScreen({ navigation }: ActivityStackScreenProps<'InterventionsHistory'>) {
  const { colors, spacing } = useTheme();
  const { data } = useInterventions('all');
  const [page, setPage] = useState(0);
  const history = data?.interventions ?? [];
  const visible = history.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const hasNext = (page + 1) * PAGE_SIZE < history.length;

  return (
    <FixedScreen
      header={<AppHeader title="Intervention History" onBack={() => navigation.goBack()} />}
      footer={
        <PaginationFooter
          page={page + 1}
          hasPrevious={page > 0}
          hasNext={hasNext}
          onPrevious={() => setPage((p) => Math.max(0, p - 1))}
          onNext={() => setPage((p) => (hasNext ? p + 1 : p))}
        />
      }
    >
      <View style={{ flex: 1, gap: spacing.sm }}>
        {visible.map((item) => (
          <Card key={item.id} padding="sm">
            <Text numberOfLines={2} style={{ color: colors.text, fontWeight: '700' }}>{item.summary}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
              {item.status} · {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
            </Text>
          </Card>
        ))}
        {history.length === 0 ? <Text style={{ color: colors.textMuted }}>No past interventions.</Text> : null}
      </View>
    </FixedScreen>
  );
}
