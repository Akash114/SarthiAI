import { apiRequest } from "./client";

export type PreferencesResponse = {
  user_id: string;
  coaching_paused: boolean;
  weekly_plans_enabled: boolean;
  interventions_enabled: boolean;
  request_id: string;
};

export async function getPreferences(userId: string): Promise<{ data: PreferencesResponse; requestId: string | null }>
{
  const { data, response } = await apiRequest<PreferencesResponse>(`/preferences?user_id=${userId}`);
  return { data, requestId: data.request_id || response.headers.get("X-Request-Id") };
}

export async function updatePreferences(
  userId: string,
  patch: Partial<Pick<PreferencesResponse, "coaching_paused" | "weekly_plans_enabled" | "interventions_enabled" >>,
): Promise<{ data: PreferencesResponse; requestId: string | null }>
{
  const { data, response } = await apiRequest<PreferencesResponse>("/preferences", {
    method: "PATCH",
    body: { user_id: userId, ...patch },
  });
  return { data, requestId: data.request_id || response.headers.get("X-Request-Id") };
}
