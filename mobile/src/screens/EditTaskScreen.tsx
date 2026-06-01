import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput } from 'react-native';
import { AppHeader, AssigneePicker, Button, Card, Chip, DueDateField, FixedScreen } from '../components';
import { usePatchTask } from '../hooks/mutations';
import { useTask, useTeam } from '../hooks/queries';
import type { GoalsStackScreenProps } from '../navigation/types';
import type { TaskPriority } from '../api/types';
import { useTheme } from '../theme';

const PRIORITIES: TaskPriority[] = ['low', 'normal', 'high'];

export function EditTaskScreen({ navigation, route }: GoalsStackScreenProps<'EditTask'>) {
  const { colors, spacing } = useTheme();
  const taskId = route.params.taskId;
  const { data: task } = useTask(taskId);
  const { data: teamDetail } = useTeam(task?.team_id ?? '');
  const patchTask = usePatchTask(taskId);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [dueAt, setDueAt] = useState<Date | null>(null);
  const [assigneeUserId, setAssigneeUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setNotes(task.notes ?? '');
    setPriority(task.priority);
    setDueAt(task.due_at ? new Date(task.due_at) : null);
    setAssigneeUserId(task.assignee_user_id ?? null);
  }, [task]);

  const onSave = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      Alert.alert('Title required', 'Enter a task title before saving.');
      return;
    }
    patchTask.mutate(
      {
        title: trimmed,
        notes: notes.trim() || null,
        priority,
        due_at: dueAt ? dueAt.toISOString() : null,
        assignee_user_id: task?.team_id ? assigneeUserId : undefined,
      },
      {
        onSuccess: () => navigation.goBack(),
        onError: (e) => Alert.alert('Save failed', e instanceof Error ? e.message : 'Could not save task.'),
      },
    );
  };

  return (
    <FixedScreen
      header={<AppHeader title="Edit Task" onBack={() => navigation.goBack()} />}
      footer={<Button title="Save task" onPress={onSave} loading={patchTask.isPending} />}
    >
      <Card>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Task title"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
        />
        <Text style={[styles.label, { color: colors.textSecondary, marginTop: spacing.md }]}>Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional notes"
          placeholderTextColor={colors.textMuted}
          multiline
          style={[styles.input, styles.multiline, { borderColor: colors.border, color: colors.text }]}
        />
        <DueDateField value={dueAt} onChange={setDueAt} />
        <Text style={[styles.label, { color: colors.textSecondary, marginTop: spacing.md }]}>Priority</Text>
        {PRIORITIES.map((value) => (
          <Chip
            key={value}
            label={value}
            selected={priority === value}
            onPress={() => setPriority(value)}
            style={{ marginRight: spacing.xs, marginTop: spacing.xs }}
          />
        ))}
        {task?.team_id && teamDetail?.members.length ? (
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
