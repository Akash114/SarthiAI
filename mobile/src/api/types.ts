// OpenAPI-derived types mirroring docs/contracts/openapi.yaml component schemas

export interface User {
  id: string;
  email: string;
}

export interface AuthTokenResponse {
  access_token: string;
  refresh_token: string;
  access_expires_at: string;
  refresh_expires_at: string;
}

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed';

export interface OnboardingState {
  status: OnboardingStatus;
  step: string;
  updated_at?: string;
}

export interface OnboardingPatchRequest {
  step?: string;
  mark_completed?: boolean;
}

export interface CoachingPreferencesState {
  coaching_paused: boolean;
  task_reminders_enabled: boolean;
  interventions_enabled: boolean;
  timezone?: string;
  updated_at?: string;
  // additive v1+
  work_hours_start?: string;
  work_hours_end?: string;
  work_days?: number[];
  personal_slots?: Record<string, 'morning' | 'afternoon' | 'evening'>;
}

export interface CoachingPreferencesPatchRequest {
  coaching_paused?: boolean;
  task_reminders_enabled?: boolean;
  interventions_enabled?: boolean;
  timezone?: string;
  // additive v1+
  work_hours_start?: string;
  work_hours_end?: string;
  work_days?: number[];
  personal_slots?: Record<string, 'morning' | 'afternoon' | 'evening'>;
}

export type ResolutionStatus = 'draft' | 'active' | 'completed' | 'abandoned';
export type Week1PlanStatus = 'not_requested' | 'pending' | 'ready' | 'failed';

export interface Resolution {
  id: string;
  title: string;
  detail?: string;
  status: ResolutionStatus;
  week_1_plan_status: Week1PlanStatus;
  plan_metadata_json?: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string;
}

export interface ResolutionCurrentResponse {
  resolution: Resolution | null;
}

export interface ResolutionCreateRequest {
  title: string;
  detail?: string;
}

export interface ResolutionPatchRequest {
  title?: string;
  detail?: string;
  status?: ResolutionStatus;
}

export interface GenerateWeek1Response {
  week_1_plan_status: Week1PlanStatus;
  job_id?: string;
}

export type TaskStatus = 'open' | 'completed' | 'skipped';

export interface Task {
  id: string;
  resolution_id: string;
  title: string;
  status: TaskStatus;
  sort_order: number;
  due_window_starts_at?: string;
  due_window_ends_at?: string;
  metadata_json?: Record<string, unknown>;
}

export interface TaskCreateRequest {
  title: string;
  resolution_id?: string;
  note?: string;
  sort_order?: number;
}

export interface TaskPatchRequest {
  title?: string;
  note?: string;
  status?: TaskStatus;
  sort_order?: number;
}

export interface TaskListResponse {
  tasks: Task[];
}

export type InterventionStatus = 'pending' | 'approved' | 'dismissed' | 'expired';

export interface Intervention {
  id: string;
  status: InterventionStatus;
  summary: string;
  detail_json?: Record<string, unknown> | null;
  created_at?: string;
  resolved_at?: string;
}

export interface FocusSessionCreateRequest {
  task_id: string;
  planned_seconds?: number | null;
}

export interface FocusSessionPatchRequest {
  ended_at?: string | null;
}

export interface FocusSessionResponse {
  id: string;
  user_id: string;
  task_id: string | null;
  started_at: string;
  ended_at?: string | null;
  planned_seconds?: number | null;
}

export interface InterventionCurrentResponse {
  intervention: Intervention | null;
}

export interface TransparencyEntry {
  id: string;
  action_type: string;
  headline: string;
  detail?: string;
  created_at: string;
}

export interface TransparencyLogPage {
  items: TransparencyEntry[];
  next_cursor?: string | null;
}

export interface DashboardResolutionSummary {
  id: string;
  title: string;
  week_1_plan_status: Week1PlanStatus;
  open_tasks: number;
  completed_tasks: number;
}

export interface DashboardResponse {
  resolution: DashboardResolutionSummary | null;
  pending_intervention: boolean;
}

export interface JourneyTaskItem {
  id: string;
  title: string;
  status: string;
  due_window_ends_at?: string | null;
}

export interface DailyJourneyResponse {
  date: string;
  tasks: JourneyTaskItem[];
}

export interface BrainDumpRequest {
  text: string;
}

export interface BrainDumpResponse {
  id: string;
  actionable: boolean;
  signals: Record<string, unknown>;
}

export interface Week1PreviewTask {
  title: string;
  sort_order: number;
}

export interface Week1PreviewResponse {
  planner_version: string;
  source: string;
  tasks: Week1PreviewTask[];
  snapshot_id: string;
}

export interface PlanSnapshotItem {
  id: string;
  kind: string;
  planner_version: string;
  created_at: string;
}

export interface PlanSnapshotDetail {
  id: string;
  kind: string;
  planner_version: string;
  tasks: Week1PreviewTask[];
  created_at: string;
}

export interface PlanHistoryResponse {
  items: PlanSnapshotItem[];
}

export interface NotificationsConfigResponse {
  enabled: boolean;
  provider: 'expo' | 'noop';
}

export interface PushTokenRegisterRequest {
  expo_push_token: string;
  platform: 'android' | 'ios';
  device_id?: string;
}
