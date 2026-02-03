import { apiRequest } from "./client";

export type JourneyCategory = {
  category: string;
  display_name: string;
  resolution_id: string;
  resolution_title: string;
  total_tasks: number;
  completed_tasks: number;
};

export type DailyJourneyResponse = {
  user_id: string;
  categories: JourneyCategory[];
  request_id: string;
};

export async function fetchDailyJourney(userId: string): Promise<DailyJourneyResponse> {
  const { data } = await apiRequest<DailyJourneyResponse>(`/journey/daily?user_id=${userId}`);
  return data;
}
