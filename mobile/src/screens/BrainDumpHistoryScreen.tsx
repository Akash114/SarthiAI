import React from 'react';
import { Text, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme';
import { Screen, AppHeader, Card } from '../components';
import { useBrainDumpsInfinite } from '../hooks/queries';
import type { SettingsStackScreenProps } from '../navigation/types';

export function BrainDumpHistoryScreen({ navigation }: SettingsStackScreenProps<'BrainDumpHistory'>) {
  const { colors, spacing } = useTheme();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } = useBrainDumpsInfinite(20);
  const items = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Screen>
      <AppHeader title="Reflections" onBack={() => navigation.goBack()} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg }}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}
        ListEmptyComponent={
          isPending ? (
            <Text style={{ color: colors.textMuted }}>Loading…</Text>
          ) : (
            <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }}>No reflections yet.</Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('BrainDumpDetail', { dumpId: item.id })}>
            <Card style={{ marginBottom: spacing.sm }}>
              <Text style={[{ color: colors.text }]} numberOfLines={3}>
                {item.excerpt}
              </Text>
              <Text style={[{ color: colors.textMuted, fontSize: 11, marginTop: 6 }]}>
                {new Date(item.created_at).toLocaleString()} · {item.actionable ? 'Actionable' : 'FYI'}
              </Text>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}
