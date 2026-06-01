import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { AppHeader, FixedScreen, GoalCard, PaginationFooter } from '../components';
import { useGoals } from '../hooks/queries';
import type { GoalsStackScreenProps } from '../navigation/types';
import { useTheme } from '../theme';

const PAGE_SIZE = 5;

export function GoalsAllScreen({ navigation }: GoalsStackScreenProps<'GoalsAll'>) {
  const { colors, spacing } = useTheme();
  const { data, isLoading } = useGoals({ status: 'active' });
  const [page, setPage] = useState(0);
  const goals = data?.goals ?? [];
  const visible = goals.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const hasNext = (page + 1) * PAGE_SIZE < goals.length;

  return (
    <FixedScreen
      header={<AppHeader title="All goals" onBack={() => navigation.goBack()} />}
      footer={
        goals.length > PAGE_SIZE ? (
          <PaginationFooter
            page={page + 1}
            hasPrevious={page > 0}
            hasNext={hasNext}
            onPrevious={() => setPage((p) => Math.max(0, p - 1))}
            onNext={() => setPage((p) => (hasNext ? p + 1 : p))}
          />
        ) : undefined
      }
    >
      <View style={{ flex: 1, gap: spacing.sm }}>
        {isLoading ? <Text style={{ color: colors.textMuted }}>Loading goals...</Text> : null}
        {!isLoading && goals.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>No active goals yet.</Text>
        ) : null}
        {visible.map((goal) => (
          <GoalCard key={goal.id} goal={goal} onPress={() => navigation.navigate('GoalDetail', { goalId: goal.id })} />
        ))}
      </View>
    </FixedScreen>
  );
}
