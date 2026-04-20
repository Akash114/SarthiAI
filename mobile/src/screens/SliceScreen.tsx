import { useCallback, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';

import { apiJson, ApiError } from '../api/client';

function formatSliceError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.body && typeof e.body === 'object' && 'message' in e.body) {
      const m = (e.body as { message: unknown }).message;
      if (typeof m === 'string' && m.length > 0) return `${e.status}: ${m}`;
    }
    return `HTTP ${e.status}`;
  }
  return e instanceof Error ? e.message : 'error';
}
import { useSessionStore } from '../state/sessionStore';
import {
  captureInterventionApproved,
  captureInterventionPromptShown,
  captureOnboardingCompleted,
  captureOnboardingStarted,
  captureResolutionCreated,
  captureTaskCompleted,
  captureWeek1PlanRequested,
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
    try {
      const r = await apiJson<{ id: string }>('/v1/resolutions', {
        method: 'POST',
        headers: { 'Idempotency-Key': `mres-${Date.now()}` },
        json: { title: 'Ship vertical slice', detail: 'Backend + mobile' },
      });
      setResolutionId(r.id);
      captureResolutionCreated(r.id);
      push(`Resolution ${r.id}`);
      setStep('plan');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const cur = await apiJson<{ resolution: { id: string } | null }>('/v1/resolutions/current');
        if (cur.resolution) {
          setResolutionId(cur.resolution.id);
          push(`Reusing existing resolution ${cur.resolution.id}`);
          setStep('plan');
          return;
        }
      }
      throw e;
    }
  }, []);

  const runPlan = useCallback(async () => {
    if (!resolutionId) return;
    try {
      await apiJson(`/v1/resolutions/${resolutionId}/generate-week-1`, {
        method: 'POST',
        headers: { 'Idempotency-Key': `mplan-${Date.now()}` },
      });
      captureWeek1PlanRequested(resolutionId);
      push('Week-1 plan requested');
      setStep('tasks');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const code =
          e.body && typeof e.body === 'object' && 'code' in e.body
            ? String((e.body as { code: unknown }).code)
            : '';
        if (code === 'week1_already_generated') {
          push('Week-1 plan already exists on this resolution — continuing to tasks');
          setStep('tasks');
          return;
        }
      }
      throw e;
    }
  }, [resolutionId]);

  const waitForPlanReady = useCallback(
    async (rid: string) => {
      const maxAttempts = 24;
      const delayMs = 1000;
      for (let i = 0; i < maxAttempts; i++) {
        const res = await apiJson<{ week_1_plan_status: string }>(`/v1/resolutions/${rid}`);
        if (res.week_1_plan_status === 'ready') return true;
        if (res.week_1_plan_status !== 'pending') return false;
        await new Promise((r) => setTimeout(r, delayMs));
      }
      return false;
    },
    [],
  );

  const runTasks = useCallback(async () => {
    if (!resolutionId) return;
    const ready = await waitForPlanReady(resolutionId);
    if (!ready) {
      push(
        'Week-1 plan is still pending or the worker is not running. Start the queue worker, wait, or use Skip below.',
      );
      return;
    }
    const tl = await apiJson<{ tasks: { id: string }[] }>(
      `/v1/resolutions/${resolutionId}/tasks`,
    );
    const first = tl.tasks[0];
    if (!first) {
      push('Plan is ready but no tasks were returned. You can skip this step or retry.');
      return;
    }
    await apiJson(`/v1/tasks/${first.id}/complete`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `mtask-${Date.now()}` },
    });
    captureTaskCompleted(resolutionId, first.id);
    push(`Task ${first.id} completed`);
    setStep('intervention');
  }, [resolutionId, waitForPlanReady]);

  const skipTasksStep = useCallback(() => {
    push('Skipped task completion — continuing the slice');
    setStep('intervention');
  }, []);

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
    captureInterventionApproved(iv.id);
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

  const onLogout = useCallback(async () => {
    try {
      const refresh = await useSessionStore.getState().readRefreshToken();
      if (refresh) {
        await apiJson('/v1/auth/logout', {
          method: 'POST',
          json: { revoke_all: false },
        });
      }
    } catch {
      /* still clear local session */
    }
    await useSessionStore.getState().clearSession();
  }, []);

  const onResetWizardDev = useCallback(() => {
    setResolutionId(null);
    setStep('onboarding');
    setLog([
      'Local wizard reset — server data unchanged. Log out and register a new user to re-run the full API slice.',
    ]);
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
      push(formatSliceError(e));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.root} testID="slice-root">
      <Text style={styles.title} testID="slice-step-label">
        Step: {step}
      </Text>
      {step !== 'done' ? (
        <View style={styles.actions}>
          <Button title="Run next step" onPress={onNext} testID="slice-next-btn" />
          {step === 'tasks' ? (
            <>
              <Text style={styles.hint}>
                Tasks show up after the backend worker finishes the week-1 job. This screen waits up to ~24s
                when you run the step; if you only run the API server, use skip.
              </Text>
              <Button
                title="Skip task step"
                onPress={skipTasksStep}
                testID="slice-skip-tasks-btn"
              />
            </>
          ) : null}
        </View>
      ) : (
        <View style={styles.doneBlock}>
          <Text testID="slice-done-label">Done</Text>
          <Button title="Log out" onPress={onLogout} testID="slice-logout-btn" />
          {__DEV__ ? (
            <Button
              title="Reset wizard (local only)"
              onPress={onResetWizardDev}
              testID="slice-reset-wizard-btn"
            />
          ) : null}
        </View>
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
  actions: { gap: 12 },
  hint: { fontSize: 14, color: '#444', lineHeight: 20 },
  log: { marginTop: 16, gap: 4 },
  doneBlock: { gap: 12 },
});
