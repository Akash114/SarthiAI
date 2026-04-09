import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { useSession } from "../session/SessionContext";
import { flushQueueItems } from "./mutationQueueFlush";
import {
  coalesceEnqueue,
  countPending,
  getTaskSyncStatus as computeTaskSyncStatus,
  loadPersistedQueue,
  newId,
  savePersistedQueue,
  type FailedItem,
  type QueuedItem,
} from "./mutationQueueStorage";

type MutationQueueContextValue = {
  userId: string | null;
  queue: QueuedItem[];
  failed: FailedItem[];
  pendingCount: number;
  isFlushing: boolean;
  lastFlushStopped: "network" | "auth" | null;
  enqueueTaskCompletion: (taskId: string, completed: boolean) => void;
  enqueueTaskNote: (taskId: string, note: string | null) => void;
  enqueueBrainDump: (text: string, clientSubmissionId: string) => void;
  clearFailed: (failedId: string) => void;
  retryFailed: (failedId: string) => void;
  flush: () => Promise<void>;
  getTaskSyncStatus: (taskId: string) => "pending" | "failed" | undefined;
};

const MutationQueueContext = createContext<MutationQueueContextValue | null>(null);

export function MutationQueueProvider({ children }: { children: ReactNode }) {
  const { effectiveUserId: userId } = useSession();
  const { isOnline } = useNetworkStatus();
  const [queue, setQueue] = useState<QueuedItem[]>([]);
  const [failed, setFailed] = useState<FailedItem[]>([]);
  const [isFlushing, setIsFlushing] = useState(false);
  const [lastFlushStopped, setLastFlushStopped] = useState<"network" | "auth" | null>(null);

  const queueRef = useRef<QueuedItem[]>([]);
  const failedRef = useRef<FailedItem[]>([]);
  const flushLock = useRef(false);

  const persistBoth = useCallback(
    (q: QueuedItem[], f: FailedItem[]) => {
      queueRef.current = q;
      failedRef.current = f;
      setQueue(q);
      setFailed(f);
      if (userId) {
        void savePersistedQueue(userId, { queue: q, failed: f });
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) {
      queueRef.current = [];
      failedRef.current = [];
      setQueue([]);
      setFailed([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const data = await loadPersistedQueue(userId);
      if (!cancelled) {
        persistBoth(data.queue, data.failed);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, persistBoth]);

  const flush = useCallback(async () => {
    if (!userId || flushLock.current) {
      return;
    }
    const q = queueRef.current;
    const f = failedRef.current;
    if (q.length === 0) {
      return;
    }
    flushLock.current = true;
    setIsFlushing(true);
    setLastFlushStopped(null);
    try {
      const result = await flushQueueItems(userId, q, f);
      if (result.stopped !== "none") {
        setLastFlushStopped(result.stopped);
      } else {
        setLastFlushStopped(null);
      }
      persistBoth(result.queue, result.failed);
    } finally {
      setIsFlushing(false);
      flushLock.current = false;
    }
  }, [userId, persistBoth]);

  const enqueueTaskCompletion = useCallback(
    (taskId: string, completed: boolean) => {
      if (!userId) return;
      const item: QueuedItem = {
        id: newId(),
        type: "task_completion",
        userId,
        taskId,
        completed,
        enqueuedAt: Date.now(),
      };
      const next = coalesceEnqueue(queueRef.current, item);
      persistBoth(next, failedRef.current);
    },
    [userId, persistBoth],
  );

  const enqueueTaskNote = useCallback(
    (taskId: string, note: string | null) => {
      if (!userId) return;
      const item: QueuedItem = {
        id: newId(),
        type: "task_note",
        userId,
        taskId,
        note,
        enqueuedAt: Date.now(),
      };
      const next = coalesceEnqueue(queueRef.current, item);
      persistBoth(next, failedRef.current);
    },
    [userId, persistBoth],
  );

  const enqueueBrainDump = useCallback(
    (text: string, clientSubmissionId: string) => {
      if (!userId) return;
      const item: QueuedItem = {
        id: newId(),
        type: "brain_dump_submit",
        userId,
        text,
        clientSubmissionId,
        enqueuedAt: Date.now(),
      };
      const next = coalesceEnqueue(queueRef.current, item);
      persistBoth(next, failedRef.current);
    },
    [userId, persistBoth],
  );

  const clearFailed = useCallback(
    (failedId: string) => {
      const nextFailed = failedRef.current.filter((x) => x.id !== failedId);
      persistBoth(queueRef.current, nextFailed);
    },
    [persistBoth],
  );

  const retryFailed = useCallback(
    (failedId: string) => {
      const entry = failedRef.current.find((x) => x.id === failedId);
      if (!entry) return;
      const nextFailed = failedRef.current.filter((x) => x.id !== failedId);
      const nextQueue = coalesceEnqueue(queueRef.current, entry.item);
      persistBoth(nextQueue, nextFailed);
    },
    [persistBoth],
  );

  const getTaskStatus = useCallback((taskId: string) => computeTaskSyncStatus(taskId, queue, failed), [queue, failed]);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === "active") {
        void flush();
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [flush]);

  const wasOnline = useRef(isOnline);
  useEffect(() => {
    if (!wasOnline.current && isOnline && queueRef.current.length > 0) {
      void flush();
    }
    wasOnline.current = isOnline;
  }, [isOnline, flush]);

  const value = useMemo<MutationQueueContextValue>(
    () => ({
      userId,
      queue,
      failed,
      pendingCount: countPending(queue),
      isFlushing,
      lastFlushStopped,
      enqueueTaskCompletion,
      enqueueTaskNote,
      enqueueBrainDump,
      clearFailed,
      retryFailed,
      flush,
      getTaskSyncStatus: getTaskStatus,
    }),
    [
      userId,
      queue,
      failed,
      isFlushing,
      lastFlushStopped,
      enqueueTaskCompletion,
      enqueueTaskNote,
      enqueueBrainDump,
      clearFailed,
      retryFailed,
      flush,
      getTaskStatus,
    ],
  );

  return <MutationQueueContext.Provider value={value}>{children}</MutationQueueContext.Provider>;
}

export function useMutationQueue(): MutationQueueContextValue {
  const ctx = useContext(MutationQueueContext);
  if (!ctx) {
    throw new Error("useMutationQueue must be used within MutationQueueProvider");
  }
  return ctx;
}
