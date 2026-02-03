import { useCallback, useEffect, useState } from "react";
import { listResolutions } from "../api/resolutions";

type Status = {
  hasActiveResolutions: boolean | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useActiveResolutions(userId: string | null): Status {
  const [hasActiveResolutions, setHasActiveResolutions] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setHasActiveResolutions(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { items } = await listResolutions(userId, "active");
      setHasActiveResolutions(items.length > 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to check resolutions.");
      setHasActiveResolutions(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    hasActiveResolutions,
    loading,
    error,
    refresh,
  };
}
