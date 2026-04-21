import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../theme';
import { Screen, AppHeader, Button, Card } from '../components';
import { useCompleteTask } from '../hooks/mutations';
import type { HomeStackScreenProps } from '../navigation/types';

export function FocusModeScreen({ navigation, route }: HomeStackScreenProps<'FocusMode'>) {
  const { colors, spacing } = useTheme();
  const { taskId, taskTitle, durationMinutes = 10 } = route.params;
  const { mutate: completeTask } = useCompleteTask(taskId);
  const secondsRef = useRef(durationMinutes * 60);
  const [seconds, setSeconds] = React.useState(durationMinutes * 60);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, []);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <Screen>
      <AppHeader title="Focus Mode" onBack={() => navigation.goBack()} />
      <View style={[styles.root, { padding: spacing.lg, backgroundColor: colors.background }]}>
        <Card style={{ alignItems: 'center', padding: spacing.xl }}>
          <Text style={[styles.taskTitle, { color: colors.text }]}>{taskTitle}</Text>
          <Text style={[styles.timer, { color: colors.indigo }]}>
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </Text>
          <Text style={[{ color: colors.textSecondary }]}>Stay focused for {durationMinutes} minutes</Text>
        </Card>

        <Button
          title="Save a thought"
          variant="ghost"
          onPress={() => navigation.push('BrainDumpModal', {})}
          style={{ marginTop: spacing.lg }}
        />
        <Button
          title="End session"
          variant="primary"
          onPress={() => {
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
  taskTitle: { fontSize: 18, fontWeight: '600', marginBottom: 24 },
  timer: { fontSize: 64, fontWeight: '300', marginBottom: 8 },
});
