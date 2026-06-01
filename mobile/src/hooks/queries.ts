import { useQuery } from '@tanstack/react-query';
import { apiJson } from '../api/client';
import { useSessionStore } from '../state/sessionStore';
import type {
  BrainDumpListPage,
  BrainDumpResponse,
  CompanionNotificationListResponse,
  CoachingPreferencesState,
  FocusSessionListPage,
  FocusSessionResponse,
  Goal,
  GoalListResponse,
  InterventionListResponse,
  NotificationsConfigResponse,
  Task,
  TaskListResponse,
  TeamDetailResponse,
  TeamListResponse,
  TransparencyLogPage,
  UserProfile,
} from '../api/types';

function queryString(params: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    sp.set(key, String(value));
  });
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export function useIsAuthenticated() {
  return useSessionStore((s) => !!s.accessToken);
}

// Auth
export function useMe() {
  const authed = useIsAuthenticated();
  return useQuery<UserProfile>({
    queryKey: ['me'],
    queryFn: () => apiJson<UserProfile>('/v1/me'),
    enabled: authed,
  });
}

export function usePreferences() {
  const authed = useIsAuthenticated();
  return useQuery<CoachingPreferencesState>({
    queryKey: ['preferences'],
    queryFn: () => apiJson<CoachingPreferencesState>('/v1/preferences'),
    enabled: authed,
  });
}

export function useNotificationsConfig() {
  return useQuery<NotificationsConfigResponse>({
    queryKey: ['notifications-config'],
    queryFn: () => apiJson<NotificationsConfigResponse>('/v1/notifications/config'),
  });
}

export function useGoals(params?: { team_id?: string | null; status?: 'active' | 'completed' | 'archived' | 'all' }) {
  const authed = useIsAuthenticated();
  const query = queryString({ team_id: params?.team_id, status: params?.status ?? 'active' });
  return useQuery<GoalListResponse>({
    queryKey: ['goals', params?.team_id ?? 'me', params?.status ?? 'active'],
    queryFn: () => apiJson<GoalListResponse>(`/v1/goals${query}`),
    enabled: authed,
  });
}

export function useGoal(goalId: string) {
  const authed = useIsAuthenticated();
  return useQuery<Goal>({
    queryKey: ['goal', goalId],
    queryFn: () => apiJson<Goal>(`/v1/goals/${goalId}`),
    enabled: authed && !!goalId,
  });
}

export function useTasks(params?: {
  team_id?: string | null;
  goal_id?: string | null;
  status?: 'open' | 'completed' | 'cancelled' | 'all';
}) {
  const authed = useIsAuthenticated();
  const query = queryString({
    team_id: params?.team_id,
    goal_id: params?.goal_id,
    status: params?.status ?? 'open',
  });
  return useQuery<TaskListResponse>({
    queryKey: ['tasks', params?.team_id ?? 'me', params?.goal_id ?? 'all', params?.status ?? 'open'],
    queryFn: () => apiJson<TaskListResponse>(`/v1/tasks${query}`),
    enabled: authed,
  });
}

export function useGoalTasks(goalId: string, status: 'open' | 'completed' | 'cancelled' | 'all' = 'open') {
  const authed = useIsAuthenticated();
  return useQuery<TaskListResponse>({
    queryKey: ['goal-tasks', goalId, status],
    queryFn: () => apiJson<TaskListResponse>(`/v1/goals/${goalId}/tasks${queryString({ status })}`),
    enabled: authed && !!goalId,
  });
}

export function useTask(taskId: string) {
  const authed = useIsAuthenticated();
  return useQuery<Task>({
    queryKey: ['task', taskId],
    queryFn: () => apiJson<Task>(`/v1/tasks/${taskId}`),
    enabled: authed && !!taskId,
  });
}

export function useNotifications(limit = 20) {
  const authed = useIsAuthenticated();
  return useQuery<CompanionNotificationListResponse>({
    queryKey: ['notifications', limit],
    queryFn: () => apiJson<CompanionNotificationListResponse>(`/v1/notifications${queryString({ limit })}`),
    enabled: authed,
  });
}

export function useInterventions(status: 'pending' | 'resolved' | 'dismissed' | 'expired' | 'all' = 'pending') {
  const authed = useIsAuthenticated();
  return useQuery<InterventionListResponse>({
    queryKey: ['interventions', status],
    queryFn: () => apiJson<InterventionListResponse>(`/v1/interventions${queryString({ status })}`),
    enabled: authed,
  });
}

export function useTransparency(params?: { cursor?: string; limit?: number }) {
  const authed = useIsAuthenticated();
  const query = queryString({ cursor: params?.cursor, limit: params?.limit ?? 20 });
  return useQuery<TransparencyLogPage>({
    queryKey: ['transparency', params?.cursor ?? null, params?.limit ?? 20],
    queryFn: () => apiJson<TransparencyLogPage>(`/v1/transparency${query}`),
    enabled: authed,
  });
}

export function useBrainDumps(params?: { cursor?: string; limit?: number }) {
  const authed = useIsAuthenticated();
  const query = queryString({ cursor: params?.cursor, limit: params?.limit ?? 5 });
  return useQuery<BrainDumpListPage>({
    queryKey: ['brain-dumps', params?.cursor ?? null, params?.limit ?? 5],
    queryFn: () => apiJson<BrainDumpListPage>(`/v1/brain-dumps${query}`),
    enabled: authed,
  });
}

export function useBrainDumpDetail(dumpId: string, poll = false) {
  const authed = useIsAuthenticated();
  return useQuery<BrainDumpResponse>({
    queryKey: ['brain-dump', dumpId],
    queryFn: () => apiJson<BrainDumpResponse>(`/v1/brain-dumps/${dumpId}`),
    enabled: authed && !!dumpId,
    refetchInterval: (query) => {
      const data = query.state.data;
      return poll && data?.processing_status === 'pending' ? 1500 : false;
    },
  });
}

export function useActiveFocusSession() {
  const authed = useIsAuthenticated();
  return useQuery<FocusSessionResponse | null>({
    queryKey: ['focus-session', 'active'],
    queryFn: () => apiJson<FocusSessionResponse | null>('/v1/focus-sessions/active'),
    enabled: authed,
  });
}

export function useFocusSessions(params?: { cursor?: string; limit?: number }) {
  const authed = useIsAuthenticated();
  const query = queryString({ cursor: params?.cursor, limit: params?.limit ?? 5 });
  return useQuery<FocusSessionListPage>({
    queryKey: ['focus-sessions', params?.cursor ?? null, params?.limit ?? 5],
    queryFn: () => apiJson<FocusSessionListPage>(`/v1/focus-sessions${query}`),
    enabled: authed,
  });
}

export function useTeams() {
  const authed = useIsAuthenticated();
  return useQuery<TeamListResponse>({
    queryKey: ['teams'],
    queryFn: () => apiJson<TeamListResponse>('/v1/teams'),
    enabled: authed,
  });
}

export function useTeam(teamId: string) {
  const authed = useIsAuthenticated();
  return useQuery<TeamDetailResponse>({
    queryKey: ['team', teamId],
    queryFn: () => apiJson<TeamDetailResponse>(`/v1/teams/${teamId}`),
    enabled: authed && !!teamId,
  });
}

export function useSharedTasks(teamId: string, status: 'open' | 'completed' | 'all' = 'open') {
  const authed = useIsAuthenticated();
  return useQuery<TaskListResponse>({
    queryKey: ['shared-tasks', teamId, status],
    queryFn: () => apiJson<TaskListResponse>(`/v1/tasks${queryString({ team_id: teamId, status })}`),
    enabled: authed && !!teamId,
  });
}
