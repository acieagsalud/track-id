import type { SetSummary } from "@/lib/sources/types";

// Spotify rejects longer values.
const NAME_MAX = 100;
const DESCRIPTION_MAX = 300;

const clip = (s: string, max: number) =>
  s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;

/** "Solomun @ Sputnik Club (2021-03-06)", falling back to the source title. */
export function playlistName(set: SetSummary): string {
  const who = set.djs.length ? set.djs.join(" & ") : null;
  const where = set.venue ?? set.event;
  if (!who) return clip(set.title, NAME_MAX);
  const base = where ? `${who} @ ${where}` : who;
  return clip(set.playedAt ? `${base} (${set.playedAt})` : base, NAME_MAX);
}

export function playlistDescription(set: SetSummary, skipped: number): string {
  // Spotify strips HTML and newlines from descriptions, so keep it to one plain line.
  const parts = [
    set.title,
    skipped > 0 ? `${skipped} track${skipped === 1 ? "" : "s"} not on Spotify` : null,
    `Tracklist: ${set.sourceUrl}`,
    "Made with track-id",
  ];
  return clip(parts.filter(Boolean).join(" · "), DESCRIPTION_MAX);
}

/** Track URIs in set order, without repeats (a track can be played twice). */
export function orderedUris(
  trackIds: (number | null)[],
  uriById: Record<number, string | null | undefined>,
): string[] {
  const seen = new Set<string>();
  const uris: string[] = [];
  for (const id of trackIds) {
    const uri = id == null ? null : uriById[id];
    if (uri && !seen.has(uri)) {
      seen.add(uri);
      uris.push(uri);
    }
  }
  return uris;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
