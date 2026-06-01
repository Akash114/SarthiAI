import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput } from 'react-native';
import { AppHeader, AssigneePicker, Button, Card, DueDateField, FixedScreen } from '../components';
import { useCreateTask } from '../hooks/mutations';
import { useMe, useTeam } from '../hooks/queries';
import type { GoalsStackScreenProps, TeamStackScreenProps } from '../navigation/types';
import { useTheme } from '../theme';

type Props = TeamStackScreenProps<'TeamCreateTask'> | GoalsStackScreenProps<'CreateTask'>;

export function TaskCreateScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const params = route.params ?? {};
  const teamId = 'teamId' in params ? params.teamId : undefined;
  const goalId = 'goalId' in params ? params.goalId : undefined;
  const createTask = useCreateTask();
  const { data: me } = useMe();
  const { data: teamDetail } = useTeam(teamId ?? '');
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState<Date | null>(null);
  const [assigneeUserId, setAssigneeUserId] = useState<string | null>(teamId ? (me?.id ?? null) : null);

  const onCreate = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    try {
      await createTask.mutateAsync({
        title: cleanTitle,
        team_id: teamId,
        goal_id: goalId,
        due_at: dueAt ? dueAt.toISOString() : undefined,
        assignee_user_id: assigneeUserId ?? undefined,
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Could not create task', e instanceof Error ? e.message : 'Try again.');
    }
  };

  return (
    <FixedScreen
      header={<AppHeader title={teamId ? 'Create Shared Task' : 'Create Task'} onBack={() => navigation.goBack()} />}
      footer={<Button title="Create task" onPress={onCreate} loading={createTask.isPending} />}
    >
      <Card>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Plan sprint review"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
        />
        <DueDateField value={dueAt} onChange={setDueAt} />
        {teamId && teamDetail?.members.length ? (
          <AssigneePicker members={teamDetail.members} value={assigneeUserId} onChange={setAssigneeUserId} />
        ) : null}
      </Card>
    </FixedScreen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12 },
});
