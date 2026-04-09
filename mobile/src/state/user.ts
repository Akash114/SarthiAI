import { useSession } from "../session/SessionContext";

/** Effective tenant id: authenticated user from JWT/session, else anonymous device UUID. */
export function useUserId(): { userId: string | null; loading: boolean } {
  const session = useSession();
  return {
    userId: session.effectiveUserId,
    loading: session.status === "bootstrapping",
  };
}
