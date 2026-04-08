import { useCallback } from "react";

export function useTaskSchedule(_userId: string | null) {
  const refresh = useCallback(async () => {}, []);

  const isSlotTaken = useCallback(
    (_day: string, _time: string, _options: { ignoreTimes?: string[] } = {}) => {
      return false;
    },
    [],
  );

  return {
    isSlotTaken,
    refresh,
  };
}
