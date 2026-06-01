import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { Card } from './Card';
import { Chip } from './Chip';
import type { Goal, Task } from '../api/types';

interface TaskRowProps {
  task: Task;
  assigneeLabel?: string | null;
  onPress?: () => void;
  onComplete?: () => void;
}

export function TaskRow({ task, assigneeLabel, onPress, onComplete }: TaskRowProps) {
  const { colors, spacing } = useTheme();
  const due = task.due_at ?? task.due_window_ends_at;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}>
      <Card padding="sm" style={styles.rowCard}>
        <View style={styles.rowMain}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>
            {task.title}
          </Text>
          <Text numberOfLines={1} style={[styles.meta, { color: colors.textMuted }]}>
            {assigneeLabel ? `${assigneeLabel} · ` : ''}
            {due ? `Due ${new Date(due).toLocaleDateString()}` : task.priority}
          </Text>
        </View>
        <View style={{ gap: spacing.xs, alignItems: 'flex-end' }}>
          <Chip label={task.status} variant={task.status === 'completed' ? 'default' : 'needsFocus'} />
          {onComplete && task.status === 'open' ? (
            <Pressable onPress={onComplete} hitSlop={8}>
              <Text style={[styles.action, { color: colors.indigo }]}>Done</Text>
            </Pressable>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

interface GoalCardProps {
  goal: Goal;
  onPress?: () => void;
}

export function GoalCard({ goal, onPress }: GoalCardProps) {
  const { colors } = useTheme();
  const card = (
    <Card padding="sm" style={styles.goalCard}>
      <View style={styles.rowMain}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>
          {goal.title}
        </Text>
        <Text numberOfLines={2} style={[styles.meta, { color: colors.textMuted }]}>
          {goal.progress_summary || goal.description || 'No progress summary yet'}
        </Text>
      </View>
      <Chip label={goal.status} variant={goal.status === 'active' ? 'default' : 'personal'} />
    </Card>
  );

  if (!onPress) return card;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}>
      {card}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { width: '100%' },
  pressed: { opacity: 0.82 },
  rowCard: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12 },
  goalCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowMain: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 3 },
  action: { fontSize: 12, fontWeight: '700' },
});
