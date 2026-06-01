import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { AppHeader, Button, Card, FixedScreen } from '../components';
import { apiJson } from '../api/client';
import { useActiveFocusSession } from '../hooks/queries';
import { useCompleteTask, useStartFocusSession } from '../hooks/mutations';
import type { FocusSessionResponse } from '../api/types';
import type { HomeStackScreenProps } from '../navigation/types';
import { useTheme } from '../theme';

export function FocusModeScreen({ navigation, route }: HomeStackScreenProps<'FocusMode'>) {
  const { colors, spacing, typography } = useTheme();
  const { taskId, taskTitle } = route.params;
  const startSession = useStartFocusSession();
  const completeTask = useCompleteTask(taskId ?? '');
  const { data: activeFocus } = useActiveFocusSession();
  const sessionRef = useRef<string | null>(null);
  const endedRef = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (activeFocus?.id) {
      sessionRef.current = activeFocus.id;
      setReady(true);
      return;
    }
    startSession.mutate(
      { task_id: taskId ?? null },
      {
        onSuccess: (session) => {
          sessionRef.current = session.id;
          setReady(true);
        },
        onError: () => setReady(true),
      },
    );
    // start focus once for this screen entry
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const endSession = async () => {
    const sessionId = sessionRef.current;
    if (!sessionId || endedRef.current) {
      navigation.goBack();
      return;
    }
    endedRef.current = true;
    try {
      const ended = await apiJson<FocusSessionResponse>(`/v1/focus-sessions/${sessionId}/end`, {
        method: 'POST',
        json: {},
      });
      if (taskId) completeTask.mutate();
      const minutes = Math.max(1, Math.round(ended.elapsed_seconds / 60));
      Alert.alert('Focus complete', `You spent ${minutes} min in focus.`, [{ text: 'Done', onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert('Could not end focus', e instanceof Error ? e.message : 'Try again.');
    }
  };

  return (
    <FixedScreen
      header={<AppHeader title="Focus Mode" onBack={endSession} />}
      footer={
        <View style={{ gap: spacing.sm }}>
          <Button
            title="Save a brain dump"
            variant="ghost"
            onPress={() => navigation.push('BrainDumpModal', { focusSessionId: sessionRef.current ?? undefined, taskId })}
          />
          <Button title="End session" onPress={endSession} />
        </View>
      }
    >
      <View style={styles.center}>
        <Text style={{ fontSize: 11, letterSpacing: 1, color: colors.textMuted, textAlign: 'center' }}>FOCUS COMPANION</Text>
        <Card style={{ alignItems: 'center', padding: spacing.xl, marginTop: spacing.md }}>
          <Text numberOfLines={3} style={[typography.title, { color: colors.text, textAlign: 'center' }]}>
            {taskTitle ?? 'Open-ended focus'}
          </Text>
          <Text style={{ color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }}>
            {ready ? 'Timer hidden. Stay with the work.' : 'Preparing your focus session...'}
          </Text>
          <View style={[styles.orb, { backgroundColor: colors.indigoLight, borderColor: colors.indigo }]} />
        </Card>
      </View>
    </FixedScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  orb: { width: 120, height: 120, borderRadius: 60, borderWidth: 2, marginTop: 28 },
});
