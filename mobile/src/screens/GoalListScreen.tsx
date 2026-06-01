import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppHeader, Button, FixedScreen, GoalCard, Modal } from '../components';
import { useGoals } from '../hooks/queries';
import { useCreateGoal } from '../hooks/mutations';
import type { GoalsStackScreenProps } from '../navigation/types';
import { useSessionStore } from '../state/sessionStore';
import { useTheme } from '../theme';

type Props = Partial<GoalsStackScreenProps<'Goals'>> & {
  finishOnboarding?: boolean;
};

export function GoalListScreen({ navigation, finishOnboarding }: Props) {
  const { colors, spacing, typography } = useTheme();
  const { data, isLoading } = useGoals({ status: 'active' });
  const createGoal = useCreateGoal();
  const setOnboardingComplete = useSessionStore((s) => s.setOnboardingComplete);
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const goals = data?.goals ?? [];
  const visibleGoals = goals.slice(0, 4);

  const submit = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    try {
      const goal = await createGoal.mutateAsync({
        title: cleanTitle,
        description: description.trim() || undefined,
      });
      setTitle('');
      setDescription('');
      setModalOpen(false);
      if (!finishOnboarding) {
        navigation?.navigate?.('GoalDetail', { goalId: goal.id });
      }
    } catch (e) {
      Alert.alert('Could not create goal', e instanceof Error ? e.message : 'Try again.');
    }
  };

  return (
    <FixedScreen
      header={<AppHeader title={finishOnboarding ? 'Your first goal' : 'Goals'} />}
      footer={
        <View style={{ gap: spacing.sm }}>
          {finishOnboarding ? (
            <Button testID="onboarding-finish-btn" title="Enter Sarthi" onPress={() => void setOnboardingComplete()} />
          ) : null}
          <Button title="New goal" onPress={() => setModalOpen(true)} />
          {!finishOnboarding ? (
            <Button title="Brain dump" variant="ghost" onPress={() => navigation?.getParent?.()?.navigate('HomeTab', { screen: 'BrainDumpModal' })} />
          ) : null}
        </View>
      }
    >
      <Text style={[typography.title, { color: colors.text }]}>Long-term direction</Text>
      <Text style={[styles.subcopy, { color: colors.textSecondary }]}>
        Keep the list tight. Deeper planning happens inside each goal.
      </Text>
      <View style={[styles.list, { gap: spacing.sm, marginTop: spacing.md }]}>
        {isLoading ? <Text style={{ color: colors.textMuted }}>Loading goals...</Text> : null}
        {!isLoading && visibleGoals.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>Create your first goal to anchor today.</Text>
        ) : null}
        {visibleGoals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            onPress={finishOnboarding ? undefined : () => navigation?.navigate?.('GoalDetail', { goalId: goal.id })}
          />
        ))}
      </View>
      {goals.length > visibleGoals.length && !finishOnboarding ? (
        <Button title={`View all ${goals.length} goals`} variant="ghost" onPress={() => navigation?.navigate?.('GoalsAll')} />
      ) : null}
      <Modal visible={modalOpen} onDismiss={() => setModalOpen(false)} title="New goal">
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
          placeholder="Goal title"
          placeholderTextColor={colors.textMuted}
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={[styles.input, styles.multiline, { borderColor: colors.border, color: colors.text }]}
          placeholder="Why this matters"
          placeholderTextColor={colors.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <Button title="Create goal" onPress={submit} loading={createGoal.isPending} />
      </Modal>
    </FixedScreen>
  );
}

const styles = StyleSheet.create({
  subcopy: { fontSize: 13, marginTop: 4 },
  list: { flex: 1 },
  more: { fontSize: 12, textAlign: 'center' },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  multiline: { minHeight: 84, textAlignVertical: 'top' },
});
