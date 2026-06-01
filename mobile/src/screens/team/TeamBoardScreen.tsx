import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppHeader, Button, Chip, FixedScreen, Modal, TaskRow } from '../../components';
import { useCompleteTaskById, useCreateGoal, useDeleteTeam, useLeaveTeam } from '../../hooks/mutations';
import { useGoals, useMe, useSharedTasks, useTeam } from '../../hooks/queries';
import type { TeamMember } from '../../api/types';
import type { TeamStackScreenProps } from '../../navigation/types';
import { useTheme } from '../../theme';

function memberLabel(member: TeamMember) {
  return member.display_name?.trim() || member.email.split('@')[0];
}

export function TeamBoardScreen({ navigation, route }: TeamStackScreenProps<'TeamBoard'>) {
  const { colors, spacing } = useTheme();
  const { teamId } = route.params;
  const [statusFilter, setStatusFilter] = useState<'open' | 'completed' | 'all'>('open');
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const { data: me } = useMe();
  const { data: detail } = useTeam(teamId);
  const { data: taskData } = useSharedTasks(teamId, statusFilter);
  const { data: goals } = useGoals({ team_id: teamId, status: 'active' });
  const completeTask = useCompleteTaskById();
  const createGoal = useCreateGoal();
  const leaveTeam = useLeaveTeam(teamId);
  const deleteTeam = useDeleteTeam(teamId);
  const tasks = taskData?.tasks ?? [];
  const membersById = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of detail?.members ?? []) {
      map.set(member.user_id, memberLabel(member));
    }
    return map;
  }, [detail?.members]);
  const myRole = useMemo(
    () => detail?.members.find((member) => member.user_id === me?.id)?.role,
    [detail?.members, me?.id],
  );
  const isAdmin = myRole === 'admin';

  const submitGoal = async () => {
    const title = goalTitle.trim();
    if (!title) return;
    try {
      await createGoal.mutateAsync({ title, team_id: teamId });
      setGoalTitle('');
      setGoalModalOpen(false);
    } catch (e) {
      Alert.alert('Could not create goal', e instanceof Error ? e.message : 'Try again.');
    }
  };

  const confirmLeave = () => {
    Alert.alert('Leave team?', 'You will lose access to shared goals and tasks.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => {
          leaveTeam.mutate(undefined, {
            onSuccess: () => navigation.navigate('TeamList'),
            onError: (e) => Alert.alert('Could not leave', e instanceof Error ? e.message : 'Try again.'),
          });
        },
      },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert('Delete team?', 'This removes the team for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteTeam.mutate(undefined, {
            onSuccess: () => navigation.navigate('TeamList'),
            onError: (e) => Alert.alert('Could not delete', e instanceof Error ? e.message : 'Try again.'),
          });
        },
      },
    ]);
  };

  return (
    <FixedScreen
      header={<AppHeader title={detail?.team.name ?? 'Team'} onBack={() => navigation.goBack()} />}
      footer={
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button title="New task" onPress={() => navigation.navigate('TeamCreateTask', { teamId })} style={{ flex: 1 }} />
            <Button title="New goal" variant="ghost" onPress={() => setGoalModalOpen(true)} style={{ flex: 1 }} />
          </View>
          <Button title="Teams" variant="ghost" onPress={() => navigation.navigate('TeamList')} />
        </View>
      }
    >
      <Text style={{ color: colors.textSecondary }}>
        {goals?.goals.length ?? 0} active goals · {detail?.members.length ?? 0} members
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.xs, marginVertical: spacing.md }}>
        {(['open', 'completed', 'all'] as const).map((status) => (
          <Chip key={status} label={status} selected={statusFilter === status} onPress={() => setStatusFilter(status)} />
        ))}
      </View>
      <View style={{ flex: 1, gap: spacing.sm }}>
        {tasks.slice(0, 4).map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            assigneeLabel={task.assignee_user_id ? membersById.get(task.assignee_user_id) : null}
            onPress={() => navigation.navigate('TeamSharedTaskDetail', { teamId, taskId: task.id })}
            onComplete={() => completeTask.mutate(task.id)}
          />
        ))}
        {tasks.length === 0 ? <Text style={{ color: colors.textMuted }}>Add a shared task everyone can see.</Text> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
        <Button title="Leave team" variant="ghost" onPress={confirmLeave} loading={leaveTeam.isPending} style={{ flex: 1 }} />
        {isAdmin ? (
          <Button title="Delete team" variant="destructive" onPress={confirmDelete} loading={deleteTeam.isPending} style={{ flex: 1 }} />
        ) : null}
      </View>
      <Modal visible={goalModalOpen} onDismiss={() => setGoalModalOpen(false)} title="Team goal">
        <TextInput
          value={goalTitle}
          onChangeText={setGoalTitle}
          placeholder="Goal title"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
        />
        <Button title="Create goal" onPress={submitGoal} loading={createGoal.isPending} style={{ marginTop: spacing.md }} />
      </Modal>
    </FixedScreen>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: 12, padding: 12 },
});
