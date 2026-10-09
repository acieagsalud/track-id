import "server-only";
import { inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { demoMatches } from "@/lib/demo";
import { isDemo } from "@/lib/env";
import { getTrack, searchTracks } from "@/lib/spotify/client";
import {
  bestMatch,
  buildQueries,
  rankCandidates,
  type MatchInput,
  type ScoredCandidate,
  type SpotifyTrack,
} from "@/lib/spotify/match";

export type MatchView = {
  status: "matched" | "not_found" | "manual";
  spotifyUri: string | null;
  spotifyName: string | null;
  spotifyArtists: string | null;
  albumArtUrl: string | null;
  confidence: number | null;
};

export type Candidate = {
  spotifyTrackId: string;
  name: string;
  artists: string;
  album: string;
  albumArtUrl: string | null;
  score: number;
};

type MatchRow = typeof schema.spotifyMatches.$inferSelect;

const toView = (r: MatchRow): MatchView => ({
  status: r.status,
  spotifyUri: r.spotifyUri,
  spotifyName: r.spotifyName,
  spotifyArtists: r.spotifyArtists,
  albumArtUrl: r.albumArtUrl,
  confidence: r.confidence,
});

const smallestImage = (t: SpotifyTrack) =>
  [...t.album.images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0))[0]?.url ?? null;

function trackFields(t: SpotifyTrack) {
  return {
    spotifyTrackId: t.id,
    spotifyUri: t.uri,
    spotifyName: t.name,
    spotifyArtists: t.artists.map((a) => a.name).join(", "),
    albumArtUrl: smallestImage(t),
  };
}

/** Matches already in the DB (no Spotify calls). */
export async function getMatches(trackIds: number[]): Promise<Record<number, MatchView>> {
  if (isDemo()) return demoMatches(trackIds);
  if (trackIds.length === 0) return {};
  const rows = await db()
    .select()
    .from(schema.spotifyMatches)
    .where(inArray(schema.spotifyMatches.trackId, trackIds));
  return Object.fromEntries(rows.map((r) => [r.trackId, toView(r)]));
}

async function findBest(input: MatchInput): Promise<ScoredCandidate | null> {
  const [strict, loose] = buildQueries(input);
  const first = await searchTracks(strict);
  const hit = bestMatch(input, first);
  if (hit) return hit;
  return bestMatch(input, [...first, ...(await searchTracks(loose))]);
}

/** Matches the given tracks, searching Spotify only for ones never matched before. */
export async function matchTracks(trackIds: number[]): Promise<Record<number, MatchView>> {
  const existing = await getMatches(trackIds);
  if (isDemo()) return existing;

  const todo = await db()
    .select()
    .from(schema.tracks)
    .where(
      inArray(
        schema.tracks.id,
        trackIds.filter((id) => !existing[id]),
      ),
    );

  // Unreleased IDs aren't on Spotify; don't spend quota on them.
  const searchable = todo.filter((t) => !t.isUnreleased);
  // Requests are capped at 10 tracks, so searching them in parallel stays well under Spotify's limits.
  const rows: (typeof schema.spotifyMatches.$inferInsert)[] = await Promise.all(
    searchable.map(async (t) => {
      const best = await findBest(t);
      return best
        ? {
            trackId: t.id,
            status: "matched" as const,
            confidence: best.score,
            ...trackFields(best.track),
          }
        : { trackId: t.id, status: "not_found" as const };
    }),
  );

  if (rows.length) {
    const saved = await db()
      .insert(schema.spotifyMatches)
      .values(rows)
      .onConflictDoNothing() // a concurrent request may have matched it first
      .returning();
    for (const r of saved) existing[r.trackId] = toView(r);
  }
  return existing;
}

export async function getCandidates(trackId: number): Promise<Candidate[]> {
  const [t] = await db()
    .select()
    .from(schema.tracks)
    .where(inArray(schema.tracks.id, [trackId]));
  if (!t) return [];
  const results = (await Promise.all(buildQueries(t).map(searchTracks))).flat();
  return rankCandidates(t, results).map((c) => ({
    spotifyTrackId: c.track.id,
    name: c.track.name,
    artists: c.track.artists.map((a) => a.name).join(", "),
    album: c.track.album.name,
    albumArtUrl: smallestImage(c.track),
    score: c.score,
  }));
}

/** A user's correction. `null` marks the track as not on Spotify. */
export async function setManualMatch(
  trackId: number,
  spotifyTrackId: string | null,
): Promise<MatchView> {
  const fields = spotifyTrackId
    ? { status: "manual" as const, confidence: 1, ...trackFields(await getTrack(spotifyTrackId)) }
    : {
        status: "not_found" as const,
        confidence: null,
        spotifyTrackId: null,
        spotifyUri: null,
        spotifyName: null,
        spotifyArtists: null,
        albumArtUrl: null,
      };
  const [row] = await db()
    .insert(schema.spotifyMatches)
    .values({ trackId, ...fields })
    .onConflictDoUpdate({
      target: schema.spotifyMatches.trackId,
      set: { ...fields, matchedAt: sql`now()` },
    })
    .returning();
  return toView(row);
}
