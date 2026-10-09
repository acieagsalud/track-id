"use client";

import { useState } from "react";
import { Check, Loader2, SearchX } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Candidate, MatchView } from "@/lib/data/match";
import { useMatches } from "./match-provider";

export function MatchBadge({ trackId }: { trackId: number }) {
  const { matches, pending, canEdit } = useMatches();
  const match = matches[trackId];

  if (pending.has(trackId)) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <Loader2 className="animate-spin" aria-hidden /> Matching
      </Badge>
    );
  }
  if (!match) return null;

  const found = match.status !== "not_found";
  const badge = found ? (
    <Badge className="bg-brand/15 text-brand">
      <Check aria-hidden /> On Spotify
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      <SearchX aria-hidden /> Not found
    </Badge>
  );

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="focus-visible:ring-ring/50 rounded-full outline-none focus-visible:ring-3"
            aria-label={
              found
                ? `Matched: ${match.spotifyName}. Change match`
                : "Not found on Spotify. Find manually"
            }
          />
        }
      >
        {badge}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <MatchDetails trackId={trackId} match={match} canEdit={canEdit} />
      </PopoverContent>
    </Popover>
  );
}

function MatchDetails({
  trackId,
  match,
  canEdit,
}: {
  trackId: number;
  match: MatchView;
  canEdit: boolean;
}) {
  const { setMatch } = useMatches();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadCandidates() {
    setBusy(true);
    try {
      const res = await fetch(`/api/tracks/${trackId}/candidates`, { method: "POST" });
      if (!res.ok) throw new Error();
      setCandidates(((await res.json()) as { candidates: Candidate[] }).candidates);
    } catch {
      toast.error("Couldn't search Spotify. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function choose(spotifyTrackId: string | null) {
    setBusy(true);
    try {
      const res = await fetch(`/api/tracks/${trackId}/match`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spotifyTrackId }),
      });
      if (!res.ok) throw new Error();
      setMatch(trackId, ((await res.json()) as { match: MatchView }).match);
      setCandidates(null);
      toast.success(spotifyTrackId ? "Match updated" : "Marked as not on Spotify");
    } catch {
      toast.error("Couldn't save that match.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      {match.status !== "not_found" ? (
        <div className="flex items-center gap-3">
          {match.albumArtUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- tiny Spotify thumbnails
            <img src={match.albumArtUrl} alt="" className="size-10 rounded" />
          )}
          <div className="min-w-0">
            <p className="truncate font-medium">{match.spotifyName}</p>
            <p className="text-muted-foreground truncate">{match.spotifyArtists}</p>
            <p className="text-muted-foreground text-xs">
              {match.status === "manual"
                ? "Picked manually"
                : `Auto-matched · ${Math.round((match.confidence ?? 0) * 100)}% confidence`}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground">No confident match on Spotify.</p>
      )}

      {!canEdit ? (
        <p className="text-muted-foreground text-xs">Sign in with Spotify to correct matches.</p>
      ) : candidates === null ? (
        <Button size="sm" variant="outline" onClick={loadCandidates} disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {match.status === "not_found" ? "Search Spotify" : "Wrong match?"}
        </Button>
      ) : (
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs">Pick the right version:</p>
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {candidates.map((c) => (
              <li key={c.spotifyTrackId}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => choose(c.spotifyTrackId)}
                  className="hover:bg-muted focus-visible:bg-muted flex w-full items-center gap-2 rounded p-1.5 text-left outline-none"
                >
                  {c.albumArtUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- tiny Spotify thumbnails
                    <img src={c.albumArtUrl} alt="" className="size-8 rounded" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{c.name}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {c.artists}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {candidates.length === 0 && <li className="text-muted-foreground">No results.</li>}
          </ul>
          <Button size="sm" variant="ghost" onClick={() => choose(null)} disabled={busy}>
            None of these
          </Button>
        </div>
      )}
    </div>
  );
}
