import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiJson } from '../api/client';
import type {
  CoachingPreferencesPatchRequest,
  OnboardingPatchRequest,
  BrainDumpRequest,
  BrainDumpResponse,
  ResolutionCreateRequest,
  ResolutionPatchRequest,
  TaskPatchRequest,
} from '../api/types';
import type { Intervention } from '../api/types';

function idempotencyKey(path: string) {
  return `${path}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function usePatchOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: Partial<OnboardingPatchRequest>) =>
      apiJson('/v1/onboarding', {
        method: 'PATCH',
        json,
        headers: { 'Idempotency-Key': idempotencyKey('/v1/onboarding') },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['onboarding'] }),
  });
}

export function usePatchPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: Partial<CoachingPreferencesPatchRequest>) =>
      apiJson('/v1/preferences', {
        method: 'PATCH',
        json,
        headers: { 'Idempotency-Key': idempotencyKey('/v1/preferences') },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['preferences'] }),
  });
}

export function usePostBrainDump() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: BrainDumpRequest) =>
      apiJson<BrainDumpResponse>('/v1/brain-dump', {
        method: 'POST',
        json,
        headers: { 'Idempotency-Key': idempotencyKey('/v1/brain-dump') },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resolution', 'current'] }),
  });
}

export function useCreateResolution() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: ResolutionCreateRequest) =>
      apiJson<{ id: string }>('/v1/resolutions', {
        method: 'POST',
        json,
        headers: { 'Idempotency-Key': idempotencyKey('/v1/resolutions') },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resolution'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function usePatchResolution(resolutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: ResolutionPatchRequest) =>
      apiJson(`/v1/resolutions/${resolutionId}`, {
        method: 'PATCH',
        json,
        headers: { 'Idempotency-Key': idempotencyKey(`/v1/resolutions/${resolutionId}`) },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resolution', resolutionId] });
      qc.invalidateQueries({ queryKey: ['resolution', 'current'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useGenerateWeek1(resolutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiJson(`/v1/resolutions/${resolutionId}/generate-week-1`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey(`/v1/resolutions/${resolutionId}/generate-week-1`) },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resolution', resolutionId] });
      qc.invalidateQueries({ queryKey: ['resolution', 'current'] });
    },
  });
}

export function usePreviewWeek1(resolutionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiJson<{ snapshot_id: string }>(`/v1/resolutions/${resolutionId}/week-1/preview`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey(`/v1/resolutions/${resolutionId}/week-1/preview`) },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['week1-preview', resolutionId] }),
  });
}

export function useCompleteTask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiJson(`/v1/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey(`/v1/tasks/${taskId}/complete`) },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['journey'] });
    },
  });
}

export function usePatchTask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: TaskPatchRequest) =>
      apiJson(`/v1/tasks/${taskId}`, {
        method: 'PATCH',
        json,
        headers: { 'Idempotency-Key': idempotencyKey(`/v1/tasks/${taskId}`) },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useApproveIntervention(interventionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiJson<Intervention>(`/v1/interventions/${interventionId}/approve`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey(`/v1/interventions/${interventionId}/approve`) },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['intervention'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDismissIntervention(interventionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiJson<Intervention>(`/v1/interventions/${interventionId}/dismiss`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey(`/v1/interventions/${interventionId}/dismiss`) },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['intervention'] }),
  });
}

export function useRegisterPushToken() {
  return useMutation({
    mutationFn: (json: { expo_push_token: string; platform: 'android' | 'ios' }) =>
      apiJson('/v1/devices/push-token', {
        method: 'POST',
        json,
        headers: { 'Idempotency-Key': idempotencyKey('/v1/devices/push-token') },
      }),
  });
}
