import { apiRequest } from "./client";

export type BrainDumpSignals = {
  sentiment_score: number;
  emotions: string[];
  topics: string[];
  actionable_items: string[];
  acknowledgement: string;
};

export type BrainDumpResponse = {
  id: string;
  acknowledgement: string;
  signals: BrainDumpSignals;
  actionable: boolean;
};

export type BrainDumpRequest = {
  user_id: string;
  text: string;
};

export async function submitBrainDump(payload: BrainDumpRequest): Promise<{
  data: BrainDumpResponse;
  requestId: string | null;
}> {
  const { data, response } = await apiRequest<BrainDumpResponse>("/brain-dump", {
    method: "POST",
    body: payload,
  });

  return {
    data,
    requestId: response.headers.get("X-Request-Id"),
  };
}
