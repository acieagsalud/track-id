"use client";

import { createContext, use, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { MatchView } from "@/lib/data/match";

type MatchState = {
  matches: Record<number, MatchView>;
  pending: Set<number>;
  canEdit: boolean;
  signedIn: boolean;
  setMatch: (trackId: number, match: MatchView) => void;
};

const MatchContext = createContext<MatchState | null>(null);

export function useMatches() {
  const ctx = use(MatchContext);
  if (!ctx) throw new Error("useMatches must be used inside <MatchProvider>");
  return ctx;
}

const BATCH = 5;

export function MatchProvider({
  trackIds,
  initial,
  canMatch,
  canEdit,
  signedIn,
  children,
}: {
  /** Tracks worth matching (identified, not unreleased). */
  trackIds: number[];
  initial: Record<number, MatchView>;
  canMatch: boolean;
  canEdit: boolean;
  signedIn: boolean;
  children: React.ReactNode;
}) {
  const [matches, setMatches] = useState(initial);
  const [pending, setPending] = useState<Set<number>>(
    () => new Set(canMatch ? trackIds.filter((id) => !initial[id]) : []),
  );

  useEffect(() => {
    if (!canMatch) return;
    const todo = trackIds.filter((id) => !initial[id]);
    let cancelled = false;

    async function requestBatch(batch: number[]) {
      // One retry covers transient failures (e.g. a route recompiling in dev, a Spotify blip).
      for (let attempt = 0; attempt < 2; attempt++) {
        const res = await fetch("/api/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackIds: batch }),
        }).catch(() => null);
        if (res?.ok) return ((await res.json()) as { matches: Record<number, MatchView> }).matches;
        if (res?.status === 401) break; // signed out; retrying won't help
        await new Promise((r) => setTimeout(r, 1000));
      }
      return null;
    }

    (async () => {
      let failed = 0;
      for (let i = 0; i < todo.length && !cancelled; i += BATCH) {
        const batch = todo.slice(i, i + BATCH);
        const got = await requestBatch(batch);
        if (cancelled) return;
        if (got) setMatches((m) => ({ ...m, ...got }));
        else failed += batch.length;
        setPending((p) => {
          const next = new Set(p);
          batch.forEach((id) => next.delete(id));
          return next;
        });
      }
      if (failed > 0)
        toast.error(
          `Couldn't match ${failed} track${failed === 1 ? "" : "s"}. Reload to try again.`,
        );
    })();

    return () => {
      cancelled = true;
    };
  }, [canMatch, trackIds, initial]);

  const setMatch = useCallback(
    (trackId: number, match: MatchView) => setMatches((m) => ({ ...m, [trackId]: match })),
    [],
  );

  return (
    <MatchContext value={{ matches, pending, canEdit, signedIn, setMatch }}>
      {children}
    </MatchContext>
  );
}
