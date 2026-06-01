import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiJson } from '../api/client';
import { useSessionStore } from '../state/sessionStore';
import type {
  AuthGoogleRequest,
  AuthPasswordLoginRequest,
  AuthPasswordRegisterRequest,
  AuthPasswordRegisterResponse,
  AuthPasswordVerifyRequest,
  AuthTokenResponse,
  BrainDumpApplyRequest,
  BrainDumpApplyResponse,
  BrainDumpCreateRequest,
  BrainDumpResponse,
  CoachingPreferencesPatchRequest,
  FocusSessionResponse,
  FocusSessionStartRequest,
  Goal,
  GoalCreateRequest,
  GoalPatchRequest,
  Intervention,
  ProfilePatchRequest,
  PushTokenRegisterRequest,
  Task,
  TaskCreateRequest,
  TaskPatchRequest,
  TeamCreateRequest,
  TeamCreateResponse,
  TeamJoinRequest,
  TeamDetailResponse,
  UserProfile,
} from '../api/types';

function idempotencyKey(path: string) {
  return `${path}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['preferences'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function usePatchProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: ProfilePatchRequest) => apiJson<UserProfile>('/v1/me', { method: 'PATCH', json }),
    onSuccess: (user) => {
      useSessionStore.getState().setUser(user);
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function usePasswordRegister() {
  return useMutation({
    mutationFn: (json: AuthPasswordRegisterRequest) =>
      apiJson<AuthPasswordRegisterResponse>('/v1/auth/password/register', { method: 'POST', json }),
  });
}

export function usePasswordVerify() {
  return useMutation({
    mutationFn: (json: AuthPasswordVerifyRequest) =>
      apiJson<AuthTokenResponse>('/v1/auth/password/verify', { method: 'POST', json }),
  });
}

export function usePasswordLogin() {
  return useMutation({
    mutationFn: (json: AuthPasswordLoginRequest) =>
      apiJson<AuthTokenResponse>('/v1/auth/password/login', { method: 'POST', json }),
  });
}

export function useGoogleLogin() {
  return useMutation({
    mutationFn: (json: AuthGoogleRequest) => apiJson<AuthTokenResponse>('/v1/auth/google', { method: 'POST', json }),
  });
}

export function usePostBrainDump(focusSessionId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: BrainDumpCreateRequest) =>
      apiJson<BrainDumpResponse>(focusSessionId ? `/v1/focus-sessions/${focusSessionId}/brain-dumps` : '/v1/brain-dumps', {
        method: 'POST',
        json,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brain-dumps'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

export function useApplyBrainDump(dumpId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: BrainDumpApplyRequest) =>
      apiJson<BrainDumpApplyResponse>(`/v1/brain-dumps/${dumpId}/apply`, {
        method: 'POST',
        json,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['goals'] });
      qc.invalidateQueries({ queryKey: ['brain-dump', dumpId] });
      qc.invalidateQueries({ queryKey: ['transparency'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: GoalCreateRequest) =>
      apiJson<Goal>('/v1/goals', {
        method: 'POST',
        json,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

export function usePatchGoal(goalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: GoalPatchRequest) => apiJson<Goal>(`/v1/goals/${goalId}`, { method: 'PATCH', json }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] });
      qc.invalidateQueries({ queryKey: ['goal', goalId] });
    },
  });
}

export function useCompleteGoal(goalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiJson<Goal>(`/v1/goals/${goalId}/complete`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] });
      qc.invalidateQueries({ queryKey: ['goal', goalId] });
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: TaskCreateRequest) =>
      apiJson<Task>('/v1/tasks', {
        method: 'POST',
        json,
      }),
    onSuccess: (task) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['shared-tasks', task.team_id ?? ''] });
      if (task.goal_id) qc.invalidateQueries({ queryKey: ['goal-tasks', task.goal_id] });
    },
  });
}

export function useCompleteTask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiJson<Task>(`/v1/tasks/${taskId}/complete`, { method: 'POST' }),
    onSuccess: (task) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      if (task.goal_id) qc.invalidateQueries({ queryKey: ['goal-tasks', task.goal_id] });
    },
  });
}

export function useCompleteTaskById() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => apiJson<Task>(`/v1/tasks/${taskId}/complete`, { method: 'POST' }),
    onSuccess: (task) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task', task.id] });
      if (task.goal_id) qc.invalidateQueries({ queryKey: ['goal-tasks', task.goal_id] });
    },
  });
}

export function usePatchTask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: TaskPatchRequest) =>
      apiJson<Task>(`/v1/tasks/${taskId}`, {
        method: 'PATCH',
        json,
      }),
    onSuccess: (task) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      if (task.goal_id) qc.invalidateQueries({ queryKey: ['goal-tasks', task.goal_id] });
    },
  });
}

export function useReopenTask(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiJson<Task>(`/v1/tasks/${taskId}/reopen`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useStartFocusSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: FocusSessionStartRequest) =>
      apiJson<FocusSessionResponse>('/v1/focus-sessions/start', { method: 'POST', json }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['focus-session', 'active'] }),
  });
}

export function useEndFocusSession(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiJson<FocusSessionResponse>(`/v1/focus-sessions/${sessionId}/end`, {
        method: 'POST',
        json: {},
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['focus-session', 'active'] }),
  });
}

export function useResolveIntervention(interventionId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      if (!interventionId) throw new Error('No intervention to resolve');
      return apiJson<Intervention>(`/v1/interventions/${interventionId}/resolve`, { method: 'POST' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interventions'] });
      qc.invalidateQueries({ queryKey: ['transparency'] });
    },
  });
}

export function useRegisterPushToken() {
  return useMutation({
    mutationFn: (json: PushTokenRegisterRequest) =>
      apiJson('/v1/devices/push-token', {
        method: 'POST',
        json,
        headers: { 'Idempotency-Key': idempotencyKey('/v1/devices/push-token') },
      }),
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: TeamCreateRequest) =>
      apiJson<TeamCreateResponse>('/v1/teams', {
        method: 'POST',
        json,
        headers: { 'Idempotency-Key': idempotencyKey('/v1/teams') },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  });
}

export function useJoinTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: TeamJoinRequest) =>
      apiJson<TeamDetailResponse>('/v1/teams/join', {
        method: 'POST',
        json,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  });
}

export function useLeaveTeam(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiJson(`/v1/teams/${teamId}/leave`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      qc.invalidateQueries({ queryKey: ['team', teamId] });
    },
  });
}

export function useDeleteTeam(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiJson(`/v1/teams/${teamId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      qc.removeQueries({ queryKey: ['team', teamId] });
    },
  });
}
