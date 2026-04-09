import AsyncStorage from "@react-native-async-storage/async-storage";
import { v4 as uuidv4 } from "uuid";

export const MAX_QUEUE_ITEMS = 200;

export type QueuedItem =
  | {
      id: string;
      type: "task_completion";
      userId: string;
      taskId: string;
      completed: boolean;
      enqueuedAt: number;
    }
  | {
      id: string;
      type: "task_note";
      userId: string;
      taskId: string;
      note: string | null;
      enqueuedAt: number;
    }
  | {
      id: string;
      type: "brain_dump_submit";
      userId: string;
      text: string;
      clientSubmissionId: string;
      enqueuedAt: number;
    };

export type FailedItem = {
  id: string;
  item: QueuedItem;
  message: string;
  failedAt: number;
};

export type QueuePersisted = {
  queue: QueuedItem[];
  failed: FailedItem[];
};

const PREFIX = "mutationQueue:v1:";

export function mutationQueueKey(userId: string): string {
  return `${PREFIX}${userId}`;
}

export function brainDumpDraftKey(userId: string): string {
  return `brainDumpDraft:v1:${userId}`;
}

export function brainDumpPendingResultKey(userId: string): string {
  return `brainDumpPendingResult:v1:${userId}`;
}

export async function loadPersistedQueue(userId: string): Promise<QueuePersisted> {
  try {
    const raw = await AsyncStorage.getItem(mutationQueueKey(userId));
    if (!raw) {
      return { queue: [], failed: [] };
    }
    const parsed = JSON.parse(raw) as QueuePersisted;
    if (!parsed || !Array.isArray(parsed.queue) || !Array.isArray(parsed.failed)) {
      return { queue: [], failed: [] };
    }
    return { queue: parsed.queue, failed: parsed.failed };
  } catch {
    return { queue: [], failed: [] };
  }
}

export async function savePersistedQueue(userId: string, data: QueuePersisted): Promise<void> {
  await AsyncStorage.setItem(mutationQueueKey(userId), JSON.stringify(data));
}

/** Remove pending items for this user (e.g. logout). */
export async function clearPersistedQueue(userId: string): Promise<void> {
  await AsyncStorage.removeItem(mutationQueueKey(userId));
  await AsyncStorage.removeItem(brainDumpDraftKey(userId));
  await AsyncStorage.removeItem(brainDumpPendingResultKey(userId));
}

export function coalesceEnqueue(queue: QueuedItem[], item: QueuedItem): QueuedItem[] {
  const filtered = queue.filter((q) => {
    if (item.type === "task_completion" && q.type === "task_completion" && q.taskId === item.taskId) {
      return false;
    }
    if (item.type === "task_note" && q.type === "task_note" && q.taskId === item.taskId) {
      return false;
    }
    if (item.type === "brain_dump_submit" && q.type === "brain_dump_submit") {
      return false;
    }
    return true;
  });
  let next = [...filtered, item];
  if (next.length > MAX_QUEUE_ITEMS) {
    next = next.slice(next.length - MAX_QUEUE_ITEMS);
  }
  return next;
}

export function newId(): string {
  return uuidv4();
}

export function getTaskSyncStatus(
  taskId: string,
  queue: QueuedItem[],
  failed: FailedItem[],
): "pending" | "failed" | undefined {
  const hasFailed = failed.some(
    (f) =>
      f.item.type !== "brain_dump_submit" &&
      (f.item.type === "task_completion" || f.item.type === "task_note") &&
      f.item.taskId === taskId,
  );
  if (hasFailed) {
    return "failed";
  }
  const hasPending = queue.some(
    (q) =>
      (q.type === "task_completion" || q.type === "task_note") && q.taskId === taskId,
  );
  if (hasPending) {
    return "pending";
  }
  return undefined;
}

export function countPending(queue: QueuedItem[]): number {
  return queue.length;
}
