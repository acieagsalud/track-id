import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isDemo } from "@/lib/env";
import { chunk, orderedUris, playlistDescription, playlistName } from "@/lib/playlist-meta";
import { getUserToken, userApi } from "@/lib/spotify/client";
import { matchTracks, type MatchView } from "./match";
import { getSet, matchableIds, type SetTrack } from "./sets";

export type SkippedTrack = {
  position: number;
  label: string;
  reason: "unreleased" | "unidentified" | "not_found";
};

export type SaveResult = {
  name: string;
  url: string | null; // null in demo mode
  added: number;
  skipped: SkippedTrack[];
  demo: boolean;
};

export type SavedPlaylist = {
  setSourceId: string;
  setTitle: string;
  name: string;
  url: string;
  trackCount: number;
  skippedCount: number;
  createdAt: Date;
};

const label = (t: SetTrack) =>
  t.artist && t.title
    ? `${t.artist} - ${t.title}${t.mixName ? ` (${t.mixName})` : ""}`
    : (t.title ?? "Unknown");

export async function saveSetAsPlaylist(
  spotifyUserId: string | null,
  sourceId: string,
): Promise<SaveResult | null> {
  const set = await getSet(sourceId);
  if (!set) return null;

  // Make sure every track has a match decision (normally done already by the page).
  const ids = matchableIds(set.tracks);
  const matches: Record<number, MatchView> = {};
  for (const batch of chunk(ids, 10)) Object.assign(matches, await matchTracks(batch));
  const uriById = Object.fromEntries(
    Object.entries(matches).map(([id, m]) => [id, m.status === "not_found" ? null : m.spotifyUri]),
  );

  const skipped: SkippedTrack[] = set.tracks.flatMap((t): SkippedTrack[] => {
    if (t.kind === "note") return [];
    if (t.kind === "unknown")
      return [{ position: t.position, label: "Unknown track", reason: "unidentified" }];
    if (t.isUnreleased) return [{ position: t.position, label: label(t), reason: "unreleased" }];
    if (t.trackId == null || !uriById[t.trackId])
      return [{ position: t.position, label: label(t), reason: "not_found" }];
    return [];
  });

  const uris = orderedUris(
    set.tracks.map((t) => t.trackId),
    uriById,
  );
  const name = playlistName(set);

  if (isDemo() || !spotifyUserId)
    return { name, url: null, added: uris.length, skipped, demo: true };
  if (uris.length === 0) return { name, url: null, added: 0, skipped, demo: false };

  const api = userApi(await getUserToken(spotifyUserId));
  const playlist = await api.createPlaylist({
    name,
    description: playlistDescription(set, skipped.length),
    public: false,
  });
  for (const batch of chunk(uris, 100)) await api.addItems(playlist.id, batch);

  const [setRow] = await db()
    .select({ id: schema.sets.id })
    .from(schema.sets)
    .where(and(eq(schema.sets.source, set.source), eq(schema.sets.sourceId, set.sourceId)));
  await db().insert(schema.userPlaylists).values({
    spotifyUserId,
    setId: setRow.id,
    spotifyPlaylistId: playlist.id,
    url: playlist.external_urls.spotify,
    trackCount: uris.length,
    skippedCount: skipped.length,
  });

  return { name, url: playlist.external_urls.spotify, added: uris.length, skipped, demo: false };
}

export async function listPlaylists(spotifyUserId: string): Promise<SavedPlaylist[]> {
  const rows = await db()
    .select({ p: schema.userPlaylists, s: schema.sets })
    .from(schema.userPlaylists)
    .innerJoin(schema.sets, eq(schema.userPlaylists.setId, schema.sets.id))
    .where(eq(schema.userPlaylists.spotifyUserId, spotifyUserId))
    .orderBy(desc(schema.userPlaylists.createdAt));
  return rows.map(({ p, s }) => ({
    setSourceId: s.sourceId,
    setTitle: s.title,
    name: playlistName(s),
    url: p.url,
    trackCount: p.trackCount,
    skippedCount: p.skippedCount,
    createdAt: p.createdAt,
  }));
}

/** The user's most recent playlist for this set, if any. */
export async function lastSavedFor(spotifyUserId: string, sourceId: string) {
  const [row] = await db()
    .select({ url: schema.userPlaylists.url, createdAt: schema.userPlaylists.createdAt })
    .from(schema.userPlaylists)
    .innerJoin(schema.sets, eq(schema.userPlaylists.setId, schema.sets.id))
    .where(
      and(
        eq(schema.userPlaylists.spotifyUserId, spotifyUserId),
        eq(schema.sets.sourceId, sourceId),
      ),
    )
    .orderBy(desc(schema.userPlaylists.createdAt))
    .limit(1);
  return row ?? null;
}
