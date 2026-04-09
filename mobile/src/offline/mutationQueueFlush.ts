import AsyncStorage from "@react-native-async-storage/async-storage";
import { submitBrainDump } from "../api/brainDump";
import { isAuthFailure, isLikelyNetworkFailure } from "../api/networkErrors";
import { updateTaskCompletion, updateTaskNote } from "../api/tasks";
import {
  brainDumpPendingResultKey,
  newId,
  type FailedItem,
  type QueuedItem,
} from "./mutationQueueStorage";

async function processOne(item: QueuedItem): Promise<void> {
  if (item.type === "task_completion") {
    await updateTaskCompletion(item.taskId, item.userId, item.completed);
    return;
  }
  if (item.type === "task_note") {
    await updateTaskNote(item.taskId, item.userId, item.note);
    return;
  }
  const { data, requestId } = await submitBrainDump({
    user_id: item.userId,
    text: item.text,
  });
  await AsyncStorage.setItem(
    brainDumpPendingResultKey(item.userId),
    JSON.stringify({ data, requestId }),
  );
}

export type FlushStopped = "none" | "network" | "auth";

/**
 * Process queue in order. Stops on first network or auth failure (head left in queue).
 * Non-recoverable errors move the item to failed and continue.
 */
export async function flushQueueItems(
  userId: string,
  queue: QueuedItem[],
  failed: FailedItem[],
): Promise<{ queue: QueuedItem[]; failed: FailedItem[]; stopped: FlushStopped }> {
  let remaining = [...queue];
  let failedNext = [...failed];

  while (remaining.length > 0) {
    const head = remaining[0];
    if (head.userId !== userId) {
      remaining = remaining.slice(1);
      continue;
    }
    try {
      await processOne(head);
      remaining = remaining.slice(1);
    } catch (e) {
      if (isAuthFailure(e)) {
        return { queue: remaining, failed: failedNext, stopped: "auth" };
      }
      if (isLikelyNetworkFailure(e)) {
        return { queue: remaining, failed: failedNext, stopped: "network" };
      }
      remaining = remaining.slice(1);
      failedNext = [
        ...failedNext,
        {
          id: newId(),
          item: head,
          message: e instanceof Error ? e.message : String(e),
          failedAt: Date.now(),
        },
      ];
    }
  }

  return { queue: remaining, failed: failedNext, stopped: "none" };
}
