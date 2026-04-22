import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  TransparencyEntry,
  BrainDumpResponse,
  PlanHistoryResponse,
  PlanSnapshotDetail,
  Week1PreviewResponse,
  NotificationsConfigResponse,
  BrainDumpListPage,
  BrainDumpDetailResponse,
  FocusSessionListResponse,
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

export function useTransparencyLogInfinite(params?: { limit?: number; action_type?: string | null }) {
  const limit = params?.limit ?? 50;
  const actionType = params?.action_type ?? undefined;
  return useInfiniteQuery({
    queryKey: ['transparency-log', 'infinite', limit, actionType],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const searchParams = new URLSearchParams();
      if (pageParam) searchParams.set('cursor', pageParam);
      searchParams.set('limit', String(limit));
      if (actionType) searchParams.set('action_type', actionType);
      const qs = searchParams.toString();
      return apiJson<TransparencyLogPage>(`/v1/transparency-log?${qs}`);
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}

export function useTransparencyEntry(entryId: string) {
  return useQuery<TransparencyEntry>({
    queryKey: ['transparency-entry', entryId],
    queryFn: () => apiJson<TransparencyEntry>(`/v1/transparency-log/${entryId}`),
    enabled: !!entryId,
  });
}

export function useNotificationsConfig() {
  return useQuery<NotificationsConfigResponse>({
    queryKey: ['notifications-config'],
    queryFn: () => apiJson<NotificationsConfigResponse>('/v1/notifications/config'),
  });
}

export function useTask(taskId: string) {
  return useQuery<Task>({
    queryKey: ['task', taskId],
    queryFn: () => apiJson<Task>(`/v1/tasks/${taskId}`),
    enabled: !!taskId,
  });
}

export function useBrainDumpsInfinite(limit = 20) {
  return useInfiniteQuery({
    queryKey: ['brain-dumps', 'infinite', limit],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const sp = new URLSearchParams();
      if (pageParam) sp.set('cursor', pageParam);
      sp.set('limit', String(limit));
      return apiJson<BrainDumpListPage>(`/v1/brain-dumps?${sp.toString()}`);
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}

export function useBrainDumpDetail(dumpId: string) {
  return useQuery<BrainDumpDetailResponse>({
    queryKey: ['brain-dump', dumpId],
    queryFn: () => apiJson<BrainDumpDetailResponse>(`/v1/brain-dumps/${dumpId}`),
    enabled: !!dumpId,
  });
}

export function useFocusSessions(limit = 40) {
  return useQuery<FocusSessionListResponse>({
    queryKey: ['focus-sessions', limit],
    queryFn: () => {
      const sp = new URLSearchParams({ limit: String(limit) });
      return apiJson<FocusSessionListResponse>(`/v1/focus-sessions?${sp.toString()}`);
    },
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
