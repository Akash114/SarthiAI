import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput } from 'react-native';
import { AppHeader, AssigneePicker, Button, Card, FixedScreen } from '../../components';
import { useCompleteTask, usePatchTask, useReopenTask } from '../../hooks/mutations';
import { useTask, useTeam } from '../../hooks/queries';
import type { TeamStackScreenProps } from '../../navigation/types';
import { useTheme } from '../../theme';

export function TeamSharedTaskDetailScreen({ navigation, route }: TeamStackScreenProps<'TeamSharedTaskDetail'>) {
  const { colors, spacing } = useTheme();
  const { teamId, taskId } = route.params;
  const { data: task } = useTask(taskId);
  const { data: teamDetail } = useTeam(teamId);
  const patchTask = usePatchTask(taskId);
  const completeTask = useCompleteTask(taskId);
  const reopenTask = useReopenTask(taskId);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [assigneeUserId, setAssigneeUserId] = useState<string | null>(null);

  const assigneeLabel = useMemo(() => {
    if (!task?.assignee_user_id || !teamDetail?.members) return null;
    const member = teamDetail.members.find((m) => m.user_id === task.assignee_user_id);
    return member?.display_name || member?.email.split('@')[0] || null;
  }, [task?.assignee_user_id, teamDetail?.members]);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setNotes(task.notes ?? '');
    setAssigneeUserId(task.assignee_user_id ?? null);
  }, [task]);

  const onSave = async () => {
    try {
      await patchTask.mutateAsync({
        title: title.trim(),
        notes: notes.trim() || null,
        assignee_user_id: assigneeUserId,
      });
      Alert.alert('Saved', 'Task updated.');
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.');
    }
  };

  return (
    <FixedScreen
      header={<AppHeader title="Shared Task" onBack={() => navigation.goBack()} />}
      footer={
        <>
          <Button title="Save changes" onPress={onSave} loading={patchTask.isPending} />
          {task?.status === 'completed' ? (
            <Button title="Reopen" variant="ghost" onPress={() => reopenTask.mutate()} style={{ marginTop: spacing.sm }} />
          ) : (
            <Button title="Mark complete" variant="ghost" onPress={() => completeTask.mutate()} style={{ marginTop: spacing.sm }} />
          )}
        </>
      }
    >
      <Card>
        {assigneeLabel ? (
          <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm }}>Assigned to {assigneeLabel}</Text>
        ) : null}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Title</Text>
        <TextInput value={title} onChangeText={setTitle} style={[styles.input, { borderColor: colors.border, color: colors.text }]} />
        <Text style={[styles.label, { color: colors.textSecondary, marginTop: spacing.md }]}>Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          multiline
          style={[styles.input, styles.multiline, { borderColor: colors.border, color: colors.text }]}
        />
        {teamDetail?.members.length ? (
          <AssigneePicker members={teamDetail.members} value={assigneeUserId} onChange={setAssigneeUserId} />
        ) : null}
      </Card>
    </FixedScreen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12 },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
});
