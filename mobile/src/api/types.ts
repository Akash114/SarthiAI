// Mobile-facing types for the rebuilt Sarthi companion backend.

export type OwnerType = 'user' | 'team';
export type GoalStatus = 'active' | 'completed' | 'archived';
export type TaskStatus = 'open' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high';
export type ProposalStatus = 'pending' | 'applied' | 'dismissed';
export type BrainDumpProcessingStatus = 'pending' | 'processed' | 'failed';
export type TeamRole = 'admin' | 'member';
export type InterventionStatus = 'pending' | 'resolved' | 'dismissed' | 'expired';
export type NotificationStatus = 'pending' | 'sent' | 'read' | 'failed';
export type ProfileSource = 'manual' | 'google';
export type AuthProvider = 'password' | 'google';

export interface AuthMethod {
  provider: AuthProvider;
  verified_at?: string | null;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name?: string | null;
  profile_image_url?: string | null;
  profile_source?: ProfileSource | null;
  email_verified_at?: string | null;
  auth_methods: AuthMethod[];
}

export interface AuthTokenResponse {
  access_token: string;
  refresh_token: string;
  access_expires_at: string;
  refresh_expires_at: string;
  user: UserProfile;
}

export interface AuthPasswordRegisterRequest {
  email: string;
  password: string;
  display_name?: string;
}

export interface AuthPasswordRegisterResponse {
  user_id: string;
  email: string;
  verification_required: boolean;
  verification_code?: string | null;
}

export interface AuthPasswordVerifyRequest {
  email: string;
  code: string;
}

export interface AuthPasswordLoginRequest {
  email: string;
  password: string;
}

export interface AuthGoogleRequest {
  id_token: string;
}

export interface AuthRefreshRequest {
  refresh_token: string;
}

export interface ProfilePatchRequest {
  display_name?: string | null;
  profile_image_url?: string | null;
}

export interface CoachingPreferencesState {
  coaching_paused: boolean;
  task_reminders_enabled: boolean;
  interventions_enabled: boolean;
  timezone?: string | null;
  updated_at?: string | null;
  home_segment_index?: number;
  work_hours_start?: string | null;
  work_hours_end?: string | null;
  work_days?: number[] | null;
  personal_slots?: Record<string, 'morning' | 'afternoon' | 'evening'> | null;
}

export interface CoachingPreferencesPatchRequest {
  coaching_paused?: boolean;
  task_reminders_enabled?: boolean;
  interventions_enabled?: boolean;
  timezone?: string | null;
  home_segment_index?: number;
  work_hours_start?: string | null;
  work_hours_end?: string | null;
  work_days?: number[] | null;
  personal_slots?: Record<string, 'morning' | 'afternoon' | 'evening'> | null;
}

export interface Goal {
  id: string;
  owner_type: OwnerType;
  user_id?: string | null;
  team_id?: string | null;
  created_by_user_id: string;
  title: string;
  description?: string | null;
  status: GoalStatus;
  target_at?: string | null;
  progress_summary?: string | null;
  metadata_json?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface GoalCreateRequest {
  title: string;
  description?: string | null;
  team_id?: string | null;
  target_at?: string | null;
  progress_summary?: string | null;
  metadata_json?: Record<string, unknown> | null;
}

export interface GoalPatchRequest {
  title?: string;
  description?: string | null;
  status?: GoalStatus;
  target_at?: string | null;
  progress_summary?: string | null;
  metadata_json?: Record<string, unknown> | null;
}

export interface GoalListResponse {
  goals: Goal[];
}

export interface Task {
  id: string;
  owner_type: OwnerType;
  user_id?: string | null;
  team_id?: string | null;
  goal_id?: string | null;
  created_by_user_id: string;
  assignee_user_id?: string | null;
  completed_by_user_id?: string | null;
  title: string;
  notes?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  sort_order: number;
  due_at?: string | null;
  due_window_starts_at?: string | null;
  due_window_ends_at?: string | null;
  source: string;
  metadata_json?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface TaskCreateRequest {
  title: string;
  notes?: string | null;
  goal_id?: string | null;
  team_id?: string | null;
  assignee_user_id?: string | null;
  priority?: TaskPriority;
  sort_order?: number;
  due_at?: string | null;
  due_window_starts_at?: string | null;
  due_window_ends_at?: string | null;
  metadata_json?: Record<string, unknown> | null;
}

export interface TaskPatchRequest {
  title?: string;
  notes?: string | null;
  goal_id?: string | null;
  assignee_user_id?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  sort_order?: number;
  due_at?: string | null;
  due_window_starts_at?: string | null;
  due_window_ends_at?: string | null;
  metadata_json?: Record<string, unknown> | null;
}

export interface TaskListResponse {
  tasks: Task[];
}

export interface Team {
  id: string;
  name: string;
  invite_code: string;
  created_by_user_id: string;
  created_at: string;
}

export interface TeamSummary {
  id: string;
  name: string;
  role: TeamRole;
  member_count: number;
}

export interface TeamListResponse {
  teams: TeamSummary[];
}

export interface TeamCreateRequest {
  name: string;
}

export interface TeamCreateResponse {
  team: Team;
  invite_code: string;
}

export interface TeamMember {
  user_id: string;
  email: string;
  role: TeamRole;
  joined_at: string;
  display_name?: string | null;
  profile_image_url?: string | null;
}

export interface TeamDetailResponse {
  team: Team;
  members: TeamMember[];
}

export interface TeamJoinRequest {
  invite_code: string;
}

export interface FocusSessionStartRequest {
  task_id?: string | null;
  context_snapshot_json?: Record<string, unknown> | null;
}

export interface FocusSessionEndRequest {
  ended_at?: string | null;
}

export interface FocusSessionResponse {
  id: string;
  user_id: string;
  task_id?: string | null;
  started_at: string;
  ended_at?: string | null;
  elapsed_seconds: number;
  context_snapshot_json?: Record<string, unknown> | null;
}

export interface FocusSessionSummary {
  id: string;
  task_id?: string | null;
  task_title?: string | null;
  started_at: string;
  ended_at?: string | null;
  elapsed_seconds: number;
}

export interface FocusSessionListPage {
  items: FocusSessionSummary[];
  next_cursor?: string | null;
}

export interface BrainDumpCreateRequest {
  text: string;
  focus_session_id?: string | null;
  task_id?: string | null;
  goal_id?: string | null;
  team_id?: string | null;
}

export interface BrainDumpAiResult {
  acknowledgement?: string;
  source?: string;
  proposal_count?: number;
  [key: string]: unknown;
}

export interface BrainDumpProposal {
  id: string;
  brain_dump_id: string;
  change_type: 'create_goal' | 'update_goal' | 'create_task' | 'update_task' | string;
  target_type: 'goal' | 'task' | string;
  target_id?: string | null;
  payload: Record<string, unknown>;
  rationale?: string | null;
  confidence?: number | null;
  status: ProposalStatus;
  created_at: string;
  applied_at?: string | null;
}

export interface BrainDumpResponse {
  id: string;
  body: string;
  actionable: boolean;
  processing_status: BrainDumpProcessingStatus;
  focus_session_id?: string | null;
  active_task_id?: string | null;
  active_goal_id?: string | null;
  team_id?: string | null;
  context_snapshot?: Record<string, unknown> | null;
  ai_result?: BrainDumpAiResult | null;
  proposals: BrainDumpProposal[];
  created_at: string;
  processed_at?: string | null;
}

export interface BrainDumpApplyRequest {
  proposal_ids?: string[];
}

export interface BrainDumpApplyResponse {
  applied_proposal_ids: string[];
  created_goal_ids: string[];
  updated_goal_ids: string[];
  created_task_ids: string[];
  updated_task_ids: string[];
}

export interface BrainDumpListItem {
  id: string;
  created_at: string;
  excerpt: string;
  actionable: boolean;
  processing_status: BrainDumpProcessingStatus;
}

export interface BrainDumpListPage {
  items: BrainDumpListItem[];
  next_cursor?: string | null;
}

export interface CompanionNotification {
  id: string;
  user_id: string;
  team_id?: string | null;
  goal_id?: string | null;
  task_id?: string | null;
  kind: string;
  title: string;
  body?: string | null;
  status: NotificationStatus;
  payload_json?: Record<string, unknown> | null;
  created_at: string;
  sent_at?: string | null;
  read_at?: string | null;
}

export interface CompanionNotificationListResponse {
  notifications: CompanionNotification[];
}

export interface Intervention {
  id: string;
  user_id?: string | null;
  team_id?: string | null;
  goal_id?: string | null;
  task_id?: string | null;
  severity?: string | null;
  reason?: string | null;
  status: InterventionStatus;
  summary: string;
  suggested_action?: string | null;
  detail_json?: Record<string, unknown> | null;
  created_at?: string;
  resolved_at?: string | null;
}

export interface InterventionListResponse {
  interventions: Intervention[];
}

export interface TransparencyEntry {
  id: string;
  action_type: string;
  headline: string;
  detail?: string | null;
  created_at: string;
  metadata_json?: Record<string, unknown> | null;
}

export interface TransparencyLogPage {
  items: TransparencyEntry[];
  next_cursor?: string | null;
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
