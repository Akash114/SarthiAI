import { useCallback, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';

import { apiJson } from '../api/client';
import {
  captureInterventionPromptShown,
  captureOnboardingCompleted,
  captureOnboardingStarted,
  captureResolutionCreated,
  captureTaskCompleted,
} from '../lib/analytics';
import { notifyInterventionPending, registerPushTokenWithBackend } from '../lib/notifications';

type Step =
  | 'onboarding'
  | 'resolution'
  | 'plan'
  | 'tasks'
  | 'intervention'
  | 'transparency'
  | 'done';

export function SliceScreen() {
  const [step, setStep] = useState<Step>('onboarding');
  const [log, setLog] = useState<string[]>([]);
  const [resolutionId, setResolutionId] = useState<string | null>(null);
  const push = (m: string) => setLog((l) => [...l, m]);

  const runOnboarding = useCallback(async () => {
    captureOnboardingStarted('post_registration');
    await apiJson('/v1/onboarding', { method: 'PATCH', json: { mark_completed: true } });
    captureOnboardingCompleted();
    push('Onboarding completed');
    setStep('resolution');
  }, []);

  const runResolution = useCallback(async () => {
    const r = await apiJson<{ id: string }>('/v1/resolutions', {
      method: 'POST',
      headers: { 'Idempotency-Key': `mres-${Date.now()}` },
      json: { title: 'Ship vertical slice', detail: 'Backend + mobile' },
    });
    setResolutionId(r.id);
    captureResolutionCreated(r.id);
    push(`Resolution ${r.id}`);
    setStep('plan');
  }, []);

  const runPlan = useCallback(async () => {
    if (!resolutionId) return;
    await apiJson(`/v1/resolutions/${resolutionId}/generate-week-1`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `mplan-${Date.now()}` },
    });
    push('Week-1 plan requested');
    setStep('tasks');
  }, [resolutionId]);

  const runTasks = useCallback(async () => {
    if (!resolutionId) return;
    const tl = await apiJson<{ tasks: { id: string }[] }>(
      `/v1/resolutions/${resolutionId}/tasks`,
    );
    const first = tl.tasks[0];
    if (!first) throw new Error('no tasks');
    await apiJson(`/v1/tasks/${first.id}/complete`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `mtask-${Date.now()}` },
    });
    captureTaskCompleted(resolutionId, first.id);
    push(`Task ${first.id} completed`);
    setStep('intervention');
  }, [resolutionId]);

  const runIntervention = useCallback(async () => {
    const cur = await apiJson<{ intervention: { id: string } | null }>('/v1/interventions/current');
    const iv = cur.intervention;
    if (!iv) {
      push('No intervention yet');
      setStep('transparency');
      return;
    }
    captureInterventionPromptShown(iv.id);
    await notifyInterventionPending();
    await apiJson(`/v1/interventions/${iv.id}/approve`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `miv-${Date.now()}` },
    });
    push(`Intervention ${iv.id} approved`);
    setStep('transparency');
  }, []);

  const runTransparency = useCallback(async () => {
    const page = await apiJson<{ items: { headline: string }[] }>('/v1/transparency-log');
    push(`Transparency entries: ${page.items.length}`);
    try {
      const tok = await import('expo-notifications').then((m) => m.getExpoPushTokenAsync());
      if (tok.data) await registerPushTokenWithBackend(tok.data);
    } catch {
      /* simulator may lack push */
    }
    setStep('done');
  }, []);

  const onNext = async () => {
    try {
      if (step === 'onboarding') await runOnboarding();
      else if (step === 'resolution') await runResolution();
      else if (step === 'plan') await runPlan();
      else if (step === 'tasks') await runTasks();
      else if (step === 'intervention') await runIntervention();
      else if (step === 'transparency') await runTransparency();
    } catch (e) {
      push(e instanceof Error ? e.message : 'error');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.root} testID="slice-root">
      <Text style={styles.title} testID="slice-step-label">
        Step: {step}
      </Text>
      {step !== 'done' ? (
        <Button title="Run next step" onPress={onNext} testID="slice-next-btn" />
      ) : (
        <Text testID="slice-done-label">Done</Text>
      )}
      <View style={styles.log}>
        {log.map((line, i) => (
          <Text key={i} testID={`slice-log-${i}`}>
            {line}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: 24, gap: 12, paddingTop: 48 },
  title: { fontSize: 18, fontWeight: '600' },
  log: { marginTop: 16, gap: 4 },
});
