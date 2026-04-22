import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../theme';
import { Screen, AppHeader, Card } from '../components';
import { useTransparencyLogInfinite } from '../hooks/queries';
import type { InterventionsStackScreenProps } from '../navigation/types';

const FILTERS: { label: string; action_type: string | null }[] = [
  { label: 'All', action_type: null },
  { label: 'Reflections', action_type: 'brain_dump_recorded' },
  { label: 'Tasks', action_type: 'task_created' },
  { label: 'Plans', action_type: 'plan_generated' },
];

export function TransparencyLogScreen({ navigation }: InterventionsStackScreenProps<'TransparencyLog'>) {
  const { colors, spacing } = useTheme();
  const [filter, setFilter] = useState<string | null>(null);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } = useTransparencyLogInfinite({
    limit: 40,
    action_type: filter,
  });
  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  return (
    <Screen>
      <AppHeader title="Transparency Log" onBack={() => navigation.goBack()} />
      <View style={[styles.filterRow, { paddingHorizontal: spacing.lg, gap: spacing.xs }]}>
        {FILTERS.map((f) => {
          const selected = filter === f.action_type;
          return (
            <Pressable
              key={f.label}
              onPress={() => setFilter(f.action_type)}
              style={[
                styles.chip,
                {
                  borderColor: selected ? colors.indigo : colors.border,
                  backgroundColor: selected ? colors.indigoLight : 'transparent',
                },
              ]}
            >
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: selected ? '700' : '500' }}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg }}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onEndReachedThreshold={0.35}
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('TransparencyEntry', { entryId: item.id })}>
            <Card style={{ marginBottom: spacing.sm }}>
              <Text style={[{ color: colors.text, fontWeight: '600' }]}>{item.headline}</Text>
              {item.detail ? (
                <Text style={[{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }]} numberOfLines={3}>
                  {item.detail}
                </Text>
              ) : null}
              <Text style={[{ color: colors.textMuted, fontSize: 11, marginTop: 4 }]}>
                {item.action_type} · {new Date(item.created_at).toLocaleString()}
              </Text>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={
          isPending ? (
            <Text style={[{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>Loading…</Text>
          ) : (
            <Text style={[{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }]}>
              No log entries yet.
            </Text>
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
});
