import { apiRequest } from "./client";

export type TaskItem = {
  id: string;
  resolution_id: string | null;
  title: string;
  scheduled_day: string | null;
  scheduled_time: string | null;
  duration_min: number | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
  source: string;
};

type ListOptions = {
  status?: "active" | "draft" | "all";
  from?: string;
  to?: string;
};

export async function listTasks(userId: string, options: ListOptions = {}): Promise<{
  tasks: TaskItem[];
  requestId: string | null;
}> {
  const params = new URLSearchParams({ user_id: userId });
  if (options.status) params.append("status", options.status);
  if (options.from) params.append("from", options.from);
  if (options.to) params.append("to", options.to);

  const { data, response } = await apiRequest<TaskItem[]>(`/tasks?${params.toString()}`);
  return {
    tasks: data,
    requestId: response.headers.get("X-Request-Id"),
  };
}
