import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiJson, type AuthTokenResponse } from '../api/client';
import type {
  User,
  OnboardingState,
  CoachingPreferencesState,
  Resolution,
  Task,
  Intervention,
  DashboardResponse,
  DailyJourneyResponse,
  TransparencyLogPage,
  BrainDumpResponse,
  PlanHistoryResponse,
  PlanSnapshotDetail,
  Week1PreviewResponse,
} from '../api/types';

// Auth
export function useMe() {
  return useQuery<User>({
    queryKey: ['me'],
    queryFn: () => apiJson<User>('/v1/me'),
  });
}

export function useOnboarding() {
  return useQuery<OnboardingState>({
    queryKey: ['onboarding'],
    queryFn: () => apiJson<OnboardingState>('/v1/onboarding'),
  });
}

export function usePreferences() {
  return useQuery<CoachingPreferencesState>({
    queryKey: ['preferences'],
    queryFn: () => apiJson<CoachingPreferencesState>('/v1/preferences'),
  });
}

export function useCurrentResolution() {
  return useQuery<Resolution | null>({
    queryKey: ['resolution', 'current'],
    queryFn: async () => {
      const res = await apiJson<{ resolution: Resolution | null }>('/v1/resolutions/current');
      return res.resolution;
    },
  });
}

export function useResolution(id: string) {
  return useQuery<Resolution>({
    queryKey: ['resolution', id],
    queryFn: () => apiJson<Resolution>(`/v1/resolutions/${id}`),
    enabled: !!id,
  });
}

export function useWeek1Tasks(resolutionId: string) {
  return useQuery<Task[]>({
    queryKey: ['tasks', resolutionId],
    queryFn: () =>
      apiJson<{ tasks: Task[] }>(`/v1/resolutions/${resolutionId}/tasks`).then((r) => r.tasks),
    enabled: !!resolutionId,
  });
}

export function useDashboard() {
  return useQuery<DashboardResponse>({
    queryKey: ['dashboard'],
    queryFn: () => apiJson<DashboardResponse>('/v1/dashboard'),
  });
}

export function useJourneyDaily() {
  return useQuery<DailyJourneyResponse>({
    queryKey: ['journey', 'daily'],
    queryFn: () => apiJson<DailyJourneyResponse>('/v1/journey/daily'),
  });
}

export function useCurrentIntervention() {
  return useQuery<Intervention | null>({
    queryKey: ['intervention', 'current'],
    queryFn: async () => {
      const res = await apiJson<{ intervention: Intervention | null }>('/v1/interventions/current');
      return res.intervention;
    },
  });
}

export function useInterventionHistory() {
  return useQuery<Intervention[]>({
    queryKey: ['interventions', 'history'],
    queryFn: () => apiJson<Intervention[]>('/v1/interventions/history'),
  });
}

export function useTransparencyLog(params?: { cursor?: string; limit?: number; action_type?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.cursor) searchParams.set('cursor', params.cursor);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.action_type) searchParams.set('action_type', params.action_type);
  const qs = searchParams.toString();
  return useQuery<TransparencyLogPage>({
    queryKey: ['transparency-log', params],
    queryFn: () =>
      apiJson<TransparencyLogPage>(`/v1/transparency-log${qs ? `?${qs}` : ''}`),
  });
}

export function usePlanHistory(resolutionId: string) {
  return useQuery<PlanHistoryResponse>({
    queryKey: ['plan-history', resolutionId],
    queryFn: () => apiJson<PlanHistoryResponse>(`/v1/resolutions/${resolutionId}/plan-history`),
    enabled: !!resolutionId,
  });
}

export function usePlanSnapshot(snapshotId: string) {
  return useQuery<PlanSnapshotDetail>({
    queryKey: ['plan-snapshot', snapshotId],
    queryFn: () => apiJson<PlanSnapshotDetail>(`/v1/plan-snapshots/${snapshotId}`),
    enabled: !!snapshotId,
  });
}

export function useWeek1Preview(resolutionId: string) {
  return useQuery<Week1PreviewResponse>({
    queryKey: ['week1-preview', resolutionId],
    queryFn: () =>
      apiJson<{ snapshot_id: string }>(`/v1/resolutions/${resolutionId}/week-1/preview`, { method: 'POST' }).then(
        (r) =>
          apiJson<Week1PreviewResponse>(`/v1/plan-snapshots/${r.snapshot_id}`)
      ),
    enabled: !!resolutionId,
  });
}
