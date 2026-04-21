import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../theme';
import { Screen, AppHeader, Button, Card } from '../components';
import { apiJson } from '../api/client';
import { useCompleteTask, useStartFocusSession } from '../hooks/mutations';
import type { HomeStackScreenProps } from '../navigation/types';

export function FocusModeScreen({ navigation, route }: HomeStackScreenProps<'FocusMode'>) {
  const { colors, spacing } = useTheme();
  const { taskId, taskTitle, durationMinutes = 10 } = route.params;
  const { mutate: completeTask } = useCompleteTask(taskId);
  const startSession = useStartFocusSession();
  const sessionIdRef = useRef<string | null>(null);
  const endedRef = useRef(false);

  const [seconds, setSeconds] = useState(durationMinutes * 60);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const planned = durationMinutes * 60;
    startSession.mutate(
      { task_id: taskId, planned_seconds: planned },
      {
        onSuccess: (res) => {
          sessionIdRef.current = res.id;
        },
      },
    );
    return () => {
      const sid = sessionIdRef.current;
      if (!sid || endedRef.current) return;
      void apiJson(`/v1/focus-sessions/${sid}`, { method: 'PATCH', json: {} }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start once per mount
  }, [taskId, durationMinutes]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const endFocusSessionRemote = () => {
    const sid = sessionIdRef.current;
    if (sid && !endedRef.current) {
      endedRef.current = true;
      void apiJson(`/v1/focus-sessions/${sid}`, { method: 'PATCH', json: {} }).catch(() => {});
    }
  };

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <Screen>
      <AppHeader title="Focus Mode" onBack={() => navigation.goBack()} />
      <View style={[styles.root, { padding: spacing.lg, backgroundColor: colors.background }]}>
        <Text style={{ fontSize: 11, letterSpacing: 1, color: colors.textMuted, textAlign: 'center' }}>FOCUS COMPANION</Text>
        <Card style={{ alignItems: 'center', padding: spacing.xl, marginTop: spacing.md }}>
          <Text style={[styles.taskTitle, { color: colors.text }]}>{taskTitle}</Text>
          <Text style={[{ color: colors.textSecondary, marginBottom: spacing.md }]}>Quiet mode enabled</Text>
          <View style={[styles.timerWrap, { backgroundColor: colors.indigo }]}>
            <Text style={styles.timer}>
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 }}>
              {Math.floor((durationMinutes * 60 - seconds) / 60)}m in · {seconds}s left
            </Text>
          </View>
        </Card>

        <Button
          title="Save a thought"
          variant="ghost"
          onPress={() => navigation.push('BrainDumpModal', {})}
          style={{ marginTop: spacing.lg }}
        />
        <Button
          title="Open insights"
          variant="ghost"
          onPress={() => Alert.alert('Insights', 'Coming soon.')}
          style={{ marginTop: spacing.sm }}
        />
        <Button
          title="End session"
          variant="primary"
          onPress={() => {
            endFocusSessionRemote();
            completeTask();
            navigation.goBack();
          }}
          style={{ marginTop: spacing.md }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  taskTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  timerWrap: { width: '100%', borderRadius: 20, paddingVertical: 24, paddingHorizontal: 16, alignItems: 'center' },
  timer: { fontSize: 48, fontWeight: '300', color: '#FFFFFF' },
});
