/**
 * Product analytics — only events listed in docs/analytics/taxonomy-v1.md (subset).
 * No PII in properties.
 */
import type PostHog from 'posthog-react-native';

import { POSTHOG_HOST, POSTHOG_KEY } from '../config';

let client: PostHog | null = null;

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
  client?.capture('onboarding_started', { entry_point: entryPoint, platform: 'android' });
}

export function captureOnboardingCompleted(): void {
  client?.capture('onboarding_completed', { platform: 'android' });
}

export function captureResolutionCreated(resolutionId: string): void {
  client?.capture('resolution_created', {
    resolution_id: resolutionId,
    had_detail: true,
    platform: 'android',
  });
}

export function captureTaskCompleted(resolutionId: string, taskId: string): void {
  client?.capture('task_completed', {
    resolution_id: resolutionId,
    task_id: taskId,
    platform: 'android',
  });
}

export function captureInterventionPromptShown(interventionId: string): void {
  client?.capture('intervention_prompt_shown', { intervention_id: interventionId, platform: 'android' });
}
