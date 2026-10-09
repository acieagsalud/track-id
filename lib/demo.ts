import {
  categoriesToMeta,
  pageUrl,
  parseSetTitle,
  parseTracklist,
} from "@/lib/sources/mixesdb/parse";
import type { MatchView } from "@/lib/data/match";
import { trackKey } from "@/lib/normalize";
import type { ParsedTrack, SetDetail } from "@/lib/sources/types";
import demoMatchesJson from "@/lib/demo-matches.json";
import p113019 from "@/lib/sources/mixesdb/__fixtures__/page-113019.json";
import p143558 from "@/lib/sources/mixesdb/__fixtures__/page-143558.json";
import p264926 from "@/lib/sources/mixesdb/__fixtures__/page-264926.json";
import p429384 from "@/lib/sources/mixesdb/__fixtures__/page-429384.json";
import p770688 from "@/lib/sources/mixesdb/__fixtures__/page-770688.json";

type Page = {
  parse: { title: string; pageid: number; wikitext: string; categories: { category: string }[] };
};

/** Real MixesDB pages bundled with the app, so demo mode needs no network or DB. */
export const DEMO_SETS: SetDetail[] = ([p264926, p113019, p770688, p429384, p143558] as Page[]).map(
  ({ parse: p }) => ({
    source: "mixesdb",
    sourceId: String(p.pageid),
    title: p.title,
    sourceUrl: pageUrl(p.title),
    ...parseSetTitle(p.title),
    ...categoriesToMeta(p.categories.map((c) => c.category)),
    tracks: parseTracklist(p.wikitext),
  }),
);

/** Stable ids for demo tracks: index into the sorted list of unique track keys. */
export const DEMO_TRACK_KEYS = [
  ...new Set(
    DEMO_SETS.flatMap((s) =>
      s.tracks.flatMap((t) =>
        t.kind === "track" && t.artist && t.title ? [trackKey(t.artist, t.title, t.mixName)] : [],
      ),
    ),
  ),
].sort();

const demoIdByKey = new Map(DEMO_TRACK_KEYS.map((k, i) => [k, i + 1]));

export function demoTrackId(t: ParsedTrack): number | null {
  return t.kind === "track" && t.artist && t.title
    ? (demoIdByKey.get(trackKey(t.artist, t.title, t.mixName)) ?? null)
    : null;
}

/** Spotify matches recorded by `npm run demo:record`, keyed by track key. */
export function demoMatches(trackIds: number[]): Record<number, MatchView> {
  const recorded = demoMatchesJson as Record<string, MatchView>;
  return Object.fromEntries(
    trackIds.flatMap((id) => {
      const m = recorded[DEMO_TRACK_KEYS[id - 1]];
      return m ? [[id, m]] : [];
    }),
  );
}
