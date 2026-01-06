import { apiRequest } from "./client";

export type WeeklyPlanResponse = {
  user_id: string;
  week: { start: string; end: string };
  inputs: {
    active_resolutions: number;
    active_tasks_total: number;
    active_tasks_completed: number;
    completion_rate: number;
  };
  micro_resolution: {
    title: string;
    why_this: string;
    suggested_week_1_tasks: {
      title: string;
      duration_min: number | null;
      suggested_time: string | null;
    }[];
  };
  request_id: string;
};

type LatestResult = {
  plan: WeeklyPlanResponse | null;
  requestId: string | null;
  notFound: boolean;
};

export async function getWeeklyPlanLatest(userId: string): Promise<LatestResult> {
  try {
    const { data, response } = await apiRequest<WeeklyPlanResponse>(`/weekly-plan/latest?user_id=${userId}`);
    return { plan: data, requestId: data.request_id || response.headers.get("X-Request-Id"), notFound: false };
  } catch (error) {
    if (error instanceof Error && /404|not found|no weekly plan snapshot/i.test(error.message)) {
      return { plan: null, requestId: null, notFound: true };
    }
    throw error;
  }
}

export async function runWeeklyPlan(userId: string): Promise<{ plan: WeeklyPlanResponse; requestId: string | null }> {
  const { data, response } = await apiRequest<WeeklyPlanResponse>("/weekly-plan/run", {
    method: "POST",
    body: { user_id: userId },
  });
  return { plan: data, requestId: data.request_id || response.headers.get("X-Request-Id") };
}

export type WeeklyPlanHistoryItem = {
  id: string;
  created_at: string;
  week_start: string;
  week_end: string;
  title: string;
  completion_rate: number | null;
};

export async function listWeeklyPlanHistory(userId: string, limit = 20): Promise<{
  items: WeeklyPlanHistoryItem[];
  requestId: string | null;
}>
{
  const { data, response } = await apiRequest<{ items: WeeklyPlanHistoryItem[]; request_id: string }>(
    `/weekly-plan/history?user_id=${userId}&limit=${limit}`,
  );
  return {
    items: data.items,
    requestId: data.request_id || response.headers.get("X-Request-Id"),
  };
}

export async function getWeeklyPlanHistoryItem(userId: string, logId: string): Promise<{
  detail: WeeklyPlanResponse;
  meta: { week_start: string; week_end: string; created_at: string };
  requestId: string | null;
}>
{
  const { data, response } = await apiRequest<{
    snapshot: WeeklyPlanResponse;
    week_start: string;
    week_end: string;
    created_at: string;
    request_id: string;
  }>(`/weekly-plan/history/${logId}?user_id=${userId}`);
  return {
    detail: data.snapshot,
    meta: { week_start: data.week_start, week_end: data.week_end, created_at: data.created_at },
    requestId: data.request_id || response.headers.get("X-Request-Id"),
  };
}
