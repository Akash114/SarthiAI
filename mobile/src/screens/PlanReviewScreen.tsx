import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTheme } from '../theme';
import { Screen, AppHeader, Card, Chip, Button, Modal } from '../components';
import { apiJson } from '../api/client';
import { useResolution, useWeek1Tasks } from '../hooks/queries';
import { useGenerateWeek1, usePreviewWeek1, usePatchResolution } from '../hooks/mutations';
import type { OnboardingScreenProps, PlanStackScreenProps } from '../navigation/types';
import type { Task } from '../api/types';

// Re-export as both onboarding and plan stack props share the same shape
export type { OnboardingScreenProps as PlanReviewScreenProps } from '../navigation/types';

const WEEK_LABELS = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12'];

function waitForPlanReady(rid: string, maxAttempts = 24, delayMs = 1000) {
  return new Promise<boolean>((resolve) => {
    let attempts = 0;
    const poll = async () => {
      try {
        const res = await apiJson<{ week_1_plan_status: string }>(`/v1/resolutions/${rid}`);
        if (res.week_1_plan_status === 'ready') { resolve(true); return; }
        if (res.week_1_plan_status !== 'pending') { resolve(false); return; }
      } catch { resolve(false); return; }
      attempts++;
      if (attempts >= maxAttempts) { resolve(false); return; }
      setTimeout(poll, delayMs);
    };
    setTimeout(poll, delayMs);
  });
}

export function PlanReviewScreen({ navigation, route }: OnboardingScreenProps<'PlanReview'>) {
  const { colors, spacing } = useTheme();
  const isOnboarding = route.params?.isOnboarding ?? false;
  const resolutionId = (route.params as { resolutionId?: string })?.resolutionId ?? '';
  const { data: resolution } = useResolution(resolutionId);
  const { data: tasks } = useWeek1Tasks(resolutionId);

  const generateMutation = useGenerateWeek1(resolutionId);
  const previewMutation = usePreviewWeek1(resolutionId);
  const patchMutation = usePatchResolution(resolutionId);

  const [showActivated, setShowActivated] = useState(false);

  const handleStart = async () => {
    if (!resolutionId) return;
    if (resolution?.week_1_plan_status !== 'ready') {
      await generateMutation.mutateAsync();
      const ready = await waitForPlanReady(resolutionId);
      if (!ready) {
        Alert.alert('Plan still generating', 'Please wait and try again.');
        return;
      }
    }
    setShowActivated(true);
  };

  const handleReject = () => {
    if (!resolutionId) return;
    patchMutation.mutate(
      { status: 'abandoned' },
      {
        onSuccess: () => {
          if (isOnboarding) navigation.getParent()?.goBack();
          else navigation.getParent()?.goBack();
        },
      }
    );
  };

  return (
    <Screen>
      <AppHeader title="Plan Review" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {/* Goal line */}
        <View style={[styles.goalRow, { marginBottom: spacing.md }]}>
          <Text style={[{ color: colors.textSecondary, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }]}>GOAL</Text>
          <Text style={[{ color: colors.text, fontWeight: '600', fontSize: 16 }]}>
            {resolution?.title ?? 'Loading…'}
          </Text>
        </View>

        {/* 12-week chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
          <View style={styles.chipsRow}>
            {WEEK_LABELS.map((w, i) => (
              <Chip
                key={w}
                label={w}
                variant={i === 0 ? 'default' : 'needsFocus'}
                style={{ marginRight: 8 }}
              />
            ))}
          </View>
        </ScrollView>

        {/* W1 task list */}
        {tasks && tasks.length > 0 ? (
          tasks.map((task: Task) => (
            <Card key={task.id} style={{ marginBottom: spacing.sm }}>
              <Text style={[{ color: colors.text }]}>{task.title}</Text>
              {task.metadata_json?.duration_minutes != null && (
                <Text style={[{ color: colors.textMuted, fontSize: 12 }]}>
                  {String(task.metadata_json.duration_minutes)}min · {String(task.metadata_json.time_of_day ?? 'morning')}
                </Text>
              )}
            </Card>
          ))
        ) : (
          <Card style={{ marginBottom: spacing.sm }}>
            <Text style={[{ color: colors.textMuted }]}>No tasks yet. Generate your week-1 plan to see tasks here.</Text>
          </Card>
        )}

        {/* Actions */}
        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          <Button title="Start Resolution" onPress={handleStart} loading={generateMutation.isPending} />
          <Button title="Regenerate" variant="ghost" onPress={() => previewMutation.mutate()} loading={previewMutation.isPending} />
          <Button title="Reject Plan" variant="destructive" onPress={handleReject} />
        </View>
      </ScrollView>

      {/* Calendar sync modal */}
      <Modal visible={showActivated} onDismiss={() => setShowActivated(false)} title="Plan Activated">
        <Card style={{ marginBottom: spacing.md }}>
          <Text style={[{ color: colors.success, fontWeight: '600' }]}>Plan Activated</Text>
          <Text style={[{ color: colors.textSecondary, marginTop: 4 }]}>
            Do you want to add these tasks to your calendar now?
          </Text>
        </Card>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Button title="Not now" variant="ghost" onPress={() => { setShowActivated(false); navigation.getParent()?.goBack(); }} style={{ flex: 1 }} />
          <Button title="Sync Tasks" onPress={() => { setShowActivated(false); Alert.alert('Calendar sync coming soon'); }} style={{ flex: 1 }} />
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  goalRow: { gap: 4 },
  chipsRow: { flexDirection: 'row', paddingVertical: 4 },
});
