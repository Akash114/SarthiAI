/**
 * Product analytics — events aligned with docs/analytics/taxonomy-v1.md (subset).
 * No PII in properties. Server routes may emit additional PostHog events with
 * different naming; client events follow the frozen taxonomy.
 */
import type PostHog from 'posthog-react-native';
import { Platform } from 'react-native';

import { POSTHOG_HOST, POSTHOG_KEY } from '../config';

let client: PostHog | null = null;

function platformProp(): 'android' | 'ios' {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

export async function initAnalytics(): Promise<void> {
  if (!POSTHOG_KEY) return;
  try {
    const { default: PostHog } = await import('posthog-react-native');
    const ph = new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
      persistence: 'memory',
    });
    await ph.ready();
    client = ph;
  } catch {
    client = null;
  }
}

export function captureOnboardingStarted(entryPoint: 'post_registration' | 'resume'): void {
  client?.capture('onboarding_started', { entry_point: entryPoint, platform: platformProp() });
}

export function captureOnboardingCompleted(): void {
  client?.capture('onboarding_completed', { platform: platformProp() });
}

export function captureResolutionCreated(resolutionId: string): void {
  client?.capture('resolution_created', {
    resolution_id: resolutionId,
    had_detail: true,
    platform: platformProp(),
  });
}

export function captureTaskCompleted(resolutionId: string, taskId: string): void {
  client?.capture('task_completed', {
    resolution_id: resolutionId,
    task_id: taskId,
    platform: platformProp(),
  });
}

export function captureInterventionPromptShown(interventionId: string): void {
  client?.capture('intervention_prompt_shown', { intervention_id: interventionId, platform: platformProp() });
}

export function captureInterventionApproved(interventionId: string): void {
  client?.capture('intervention_approved', { intervention_id: interventionId, platform: platformProp() });
}

export function captureWeek1PlanRequested(resolutionId: string): void {
  client?.capture('week_1_plan_requested', { resolution_id: resolutionId, platform: platformProp() });
}

export function capturePushTokenRegistered(platform: 'android' | 'ios'): void {
  client?.capture('push_token_registered', { platform });
}
