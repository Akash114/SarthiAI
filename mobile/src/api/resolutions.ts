import { apiRequest } from "./client";

export type ResolutionResponse = {
  id: string;
  user_id: string;
  title: string;
  raw_text: string;
  type: string;
  category: string;
  domain: "personal" | "work";
  duration_weeks: number | null;
  status: string;
  request_id?: string;
};

export type PlanMilestone = {
  week: number;
  focus: string;
  success_criteria: string[];
};

export type PlanPayload = {
  weeks: number;
  milestones: PlanMilestone[];
};

export type WeekOneTask = {
  id: string;
  title: string;
  scheduled_day: string | null;
  scheduled_time: string | null;
  duration_min: number | null;
  draft: boolean;
  intent?: string;
  cadence?: string;
  confidence?: string;
  note?: string | null;
};

export type WeekPlanTask = WeekOneTask;

export type WeekPlanSection = {
  week: number;
  focus: string;
  tasks: WeekPlanTask[];
};

export type DecompositionResponse = {
  resolution_id: string;
  user_id: string;
  title: string;
  type: string;
  duration_weeks: number | null;
  plan: PlanPayload;
  week_1_tasks: WeekOneTask[];
  weeks: WeekPlanSection[];
  request_id?: string;
};

export type TaskEditPayload = {
  task_id: string;
  title?: string;
  scheduled_day?: string;
  scheduled_time?: string;
  duration_min?: number;
};

export type ApprovalResponse = {
  resolution_id: string;
  status: string;
  tasks_activated?: {
    id: string;
    title: string;
    scheduled_day: string | null;
    scheduled_time: string | null;
    duration_min: number | null;
  }[];
  message?: string | null;
  request_id?: string;
};

export type ResolutionSummary = {
  id: string;
  title: string;
  type: string;
  category?: string | null;
  domain: string;
  status: string;
  duration_weeks: number | null;
  updated_at: string;
};

export type ResolutionDetail = {
  id: string;
  user_id: string;
  title: string;
  type: string;
  category?: string | null;
  domain: string;
  status: string;
  duration_weeks: number | null;
  plan: PlanPayload | null;
  plan_weeks: WeekPlanSection[];
  draft_tasks: WeekOneTask[];
  active_tasks: {
    id: string;
    title: string;
    scheduled_day: string | null;
    scheduled_time: string | null;
    duration_min: number | null;
  }[];
  request_id?: string;
};

type ApiResult<T> = {
  data: T;
  requestId: string | null;
};

const getRequestId = (bodyRequestId?: string, response?: Response): string | null => {
  if (bodyRequestId) return bodyRequestId;
  return response?.headers.get("X-Request-Id");
};

export async function createResolution(payload: {
  user_id: string;
  text: string;
  duration_weeks?: number;
  domain?: "personal" | "work";
}): Promise<{ resolution: ResolutionResponse; requestId: string | null }> {
  const { data, response } = await apiRequest<ResolutionResponse>("/resolutions", {
    method: "POST",
    body: payload,
  });

  return {
    resolution: data,
    requestId: getRequestId(data.request_id, response),
  };
}

export async function decomposeResolution(
  resolutionId: string,
  body: { weeks?: number; regenerate?: boolean } = {},
): Promise<{ result: DecompositionResponse; requestId: string | null }> {
  const { data, response } = await apiRequest<DecompositionResponse>(`/resolutions/${resolutionId}/decompose`, {
    method: "POST",
    body,
  });

  return {
    result: data,
    requestId: getRequestId(data.request_id, response),
  };
}

export async function approveResolution(
  resolutionId: string,
  payload: {
    user_id: string;
    decision: "accept" | "reject" | "regenerate";
    task_edits?: TaskEditPayload[];
  },
): Promise<{ result: ApprovalResponse; requestId: string | null }> {
  const { data, response } = await apiRequest<ApprovalResponse>(`/resolutions/${resolutionId}/approve`, {
    method: "POST",
    body: payload,
  });

  return {
    result: data,
    requestId: getRequestId(data.request_id, response),
  };
}

export async function listResolutions(userId: string, status?: "draft" | "active"): Promise<{ items: ResolutionSummary[]; requestId: string | null }> {
  const query = new URLSearchParams({ user_id: userId });
  if (status) query.append("status", status);
  const { data, response } = await apiRequest<ResolutionSummary[]>(`/resolutions?${query.toString()}`);
  return { items: data, requestId: response.headers.get("X-Request-Id") };
}

export async function getResolution(
  resolutionId: string,
  userId: string,
): Promise<{ resolution: ResolutionDetail; requestId: string | null }> {
  const query = new URLSearchParams({ user_id: userId });
  const { data, response } = await apiRequest<ResolutionDetail>(`/resolutions/${resolutionId}?${query.toString()}`);
  return { resolution: data, requestId: data.request_id || response.headers.get("X-Request-Id") };
}
