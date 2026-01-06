import { apiRequest } from "./client";

export type InterventionResponse = {
  user_id: string;
  week: { start: string; end: string };
  slippage: {
    flagged: boolean;
    reason: string | null;
    completion_rate: number;
    missed_scheduled: number;
  };
  card: {
    title: string;
    message: string;
    options: { key: string; label: string; details: string }[];
  } | null;
  request_id: string;
};

type LatestResult = {
  intervention: InterventionResponse | null;
  requestId: string | null;
  notFound: boolean;
};

export async function getInterventionsLatest(userId: string): Promise<LatestResult> {
  try {
    const { data, response } = await apiRequest<InterventionResponse>(`/interventions/latest?user_id=${userId}`);
    return { intervention: data, requestId: data.request_id || response.headers.get("X-Request-Id"), notFound: false };
  } catch (error) {
    if (error instanceof Error && /404|not found|no intervention snapshot/i.test(error.message)) {
      return { intervention: null, requestId: null, notFound: true };
    }
    throw error;
  }
}

export async function runInterventions(userId: string): Promise<{ intervention: InterventionResponse; requestId: string | null }> {
  const { data, response } = await apiRequest<InterventionResponse>("/interventions/run", {
    method: "POST",
    body: { user_id: userId },
  });
  return { intervention: data, requestId: data.request_id || response.headers.get("X-Request-Id") };
}

export type InterventionHistoryItem = {
  id: string;
  created_at: string;
  week_start: string;
  week_end: string;
  flagged: boolean;
  reason: string | null;
};

export async function listInterventionsHistory(userId: string, limit = 20): Promise<{
  items: InterventionHistoryItem[];
  requestId: string | null;
}>
{
  const { data, response } = await apiRequest<{ items: InterventionHistoryItem[]; request_id: string }>(
    `/interventions/history?user_id=${userId}&limit=${limit}`,
  );
  return {
    items: data.items,
    requestId: data.request_id || response.headers.get("X-Request-Id"),
  };
}

export async function getInterventionHistoryItem(userId: string, logId: string): Promise<{
  detail: InterventionResponse;
  meta: { week_start: string; week_end: string; created_at: string };
  requestId: string | null;
}>
{
  const { data, response } = await apiRequest<{
    snapshot: InterventionResponse;
    week_start: string;
    week_end: string;
    created_at: string;
    request_id: string;
  }>(`/interventions/history/${logId}?user_id=${userId}`);
  return {
    detail: data.snapshot,
    meta: { week_start: data.week_start, week_end: data.week_end, created_at: data.created_at },
    requestId: data.request_id || response.headers.get("X-Request-Id"),
  };
}
