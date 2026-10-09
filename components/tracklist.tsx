import { MatchBadge } from "@/components/match-badge";
import { Badge } from "@/components/ui/badge";
import type { SetTrack } from "@/lib/data/sets";
import { formatCue } from "@/lib/format";
import { cn } from "@/lib/utils";

function TrackStatus({ track }: { track: SetTrack }) {
  if (track.kind === "unknown") return <Badge variant="outline">Unidentified</Badge>;
  if (track.isUnreleased) return <Badge variant="secondary">Unreleased ID</Badge>;
  if (track.trackId != null) return <MatchBadge trackId={track.trackId} />;
  return null;
}

function TrackRow({ track }: { track: SetTrack }) {
  const muted = track.kind !== "track";
  return (
    <li
      className={cn(
        "grid grid-cols-[2.5rem_1fr_auto] items-start gap-3 px-3 py-2.5 sm:grid-cols-[2.5rem_4.5rem_1fr_auto]",
        track.isMashupPart && "pl-8",
      )}
    >
      <span className="text-muted-foreground pt-0.5 text-right font-mono text-xs tabular-nums">
        {track.position}
      </span>
      <span className="text-muted-foreground hidden pt-0.5 font-mono text-xs tabular-nums sm:block">
        {track.cueSec != null ? formatCue(track.cueSec) : ""}
      </span>
      <div className={cn("min-w-0", muted && "text-muted-foreground")}>
        {track.kind === "track" ? (
          <>
            <p className="truncate font-medium">
              {track.isMashupPart && <span className="text-muted-foreground mr-1">+</span>}
              {track.title}
              {track.mixName && (
                <span className="text-muted-foreground font-normal"> ({track.mixName})</span>
              )}
            </p>
            <p className="text-muted-foreground truncate text-sm">
              {track.artist}
              {track.label && <span className="opacity-70"> · {track.label}</span>}
            </p>
          </>
        ) : (
          <p className="italic">{track.kind === "unknown" ? "Unknown track" : track.title}</p>
        )}
      </div>
      <TrackStatus track={track} />
    </li>
  );
}

export function Tracklist({ tracks }: { tracks: SetTrack[] }) {
  // Group consecutive tracks by section so b2b pages render one block per DJ.
  const groups: { section: string | null; tracks: SetTrack[] }[] = [];
  for (const t of tracks) {
    const last = groups.at(-1);
    if (last && last.section === t.section) last.tracks.push(t);
    else groups.push({ section: t.section, tracks: [t] });
  }

  return (
    <div className="space-y-6">
      {groups.map((g, i) => (
        <section key={i} aria-label={g.section ?? "Tracklist"}>
          {g.section && <h2 className="mb-2 text-sm font-semibold">{g.section}</h2>}
          <ol className="divide-y rounded-lg border">
            {g.tracks.map((t) => (
              <TrackRow key={t.position} track={t} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

export function TracklistSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading tracklist">
      <div className="bg-muted/40 h-24 animate-pulse rounded-lg" />
      <div className="divide-y rounded-lg border">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="flex gap-3 px-3 py-3">
            <div className="bg-muted/60 h-4 w-6 animate-pulse rounded" />
            <div className="flex-1 space-y-1.5">
              <div className="bg-muted/60 h-4 w-1/2 animate-pulse rounded" />
              <div className="bg-muted/40 h-3 w-1/3 animate-pulse rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
