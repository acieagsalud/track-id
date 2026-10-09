import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { connection } from "next/server";
import { db, schema } from "@/lib/db";
import { DEMO_SETS, demoTrackId } from "@/lib/demo";
import { isDemo } from "@/lib/env";
import { normalize, trackKey } from "@/lib/normalize";
import { mixesdb } from "@/lib/sources/mixesdb/client";
import { parseTrackLine } from "@/lib/sources/mixesdb/parse";
import type { ParsedTrack, SetDetail, SetSummary } from "@/lib/sources/types";

const DAY = 24 * 60 * 60 * 1000;
const LIST_TTL = 1 * DAY; // search results and DJ set lists gain new sets
const TRACKLIST_TTL = 30 * DAY; // tracklists rarely change once written

export type SetTrack = ParsedTrack & { trackId: number | null };
export type SetView = Omit<SetDetail, "tracks"> & { tracks: SetTrack[] };

/** Tracks worth looking up on Spotify. */
export function matchableIds(tracks: SetTrack[]): number[] {
  return [
    ...new Set(
      tracks.flatMap((t) =>
        t.kind === "track" && !t.isUnreleased && t.trackId != null ? [t.trackId] : [],
      ),
    ),
  ];
}

const isFresh = (at: Date | null | undefined, ttl: number) =>
  !!at && Date.now() - at.getTime() < ttl;

function rowToSummary(r: typeof schema.sets.$inferSelect): SetSummary {
  return {
    source: r.source,
    sourceId: r.sourceId,
    title: r.title,
    djs: r.djs,
    venue: r.venue,
    event: r.event,
    playedAt: r.playedAt,
    sourceUrl: r.sourceUrl,
  };
}

async function upsertSummaries(summaries: SetSummary[]) {
  if (summaries.length === 0) return;
  await db()
    .insert(schema.sets)
    .values(summaries)
    .onConflictDoUpdate({
      target: [schema.sets.source, schema.sets.sourceId],
      set: { title: sql`excluded.title`, djs: sql`excluded.djs`, fetchedAt: sql`now()` },
    });
}

/** Loads cached summaries and returns them in the order of `sourceIds`. */
async function loadSummaries(sourceIds: string[]): Promise<SetSummary[]> {
  if (sourceIds.length === 0) return [];
  const rows = await db()
    .select()
    .from(schema.sets)
    .where(and(eq(schema.sets.source, "mixesdb"), inArray(schema.sets.sourceId, sourceIds)));
  const byId = new Map(rows.map((r) => [r.sourceId, rowToSummary(r)]));
  return sourceIds.flatMap((id) => byId.get(id) ?? []);
}

export async function searchSets(query: string): Promise<SetSummary[]> {
  const q = normalize(query);
  if (!q) return [];
  if (isDemo()) {
    return DEMO_SETS.filter((s) =>
      normalize(`${s.title} ${s.tracks.map((t) => t.rawLine).join(" ")}`).includes(q),
    );
  }
  await connection();

  const [cached] = await db().select().from(schema.searches).where(eq(schema.searches.query, q));
  if (cached && isFresh(cached.fetchedAt, LIST_TTL)) return loadSummaries(cached.setSourceIds);

  const results = await mixesdb.search(query);
  await upsertSummaries(results);
  const ids = results.map((r) => r.sourceId);
  await db()
    .insert(schema.searches)
    .values({ query: q, setSourceIds: ids })
    .onConflictDoUpdate({
      target: schema.searches.query,
      set: { setSourceIds: ids, fetchedAt: sql`now()` },
    });
  return results;
}

export async function getDjSets(name: string): Promise<SetSummary[]> {
  if (isDemo()) return DEMO_SETS.filter((s) => s.djs.some((d) => normalize(d) === normalize(name)));
  await connection();

  const slug = normalize(name);
  const [cached] = await db().select().from(schema.djs).where(eq(schema.djs.slug, slug));
  if (cached && isFresh(cached.fetchedAt, LIST_TTL)) return loadSummaries(cached.setSourceIds);

  const results = await mixesdb.getSetsByDj(name);
  await upsertSummaries(results);
  const ids = results.map((r) => r.sourceId);
  await db()
    .insert(schema.djs)
    .values({ name, slug, setSourceIds: ids })
    .onConflictDoUpdate({
      target: schema.djs.slug,
      set: { name, setSourceIds: ids, fetchedAt: sql`now()` },
    });
  return results;
}

export async function getSet(sourceId: string): Promise<SetView | null> {
  if (isDemo()) {
    const set = DEMO_SETS.find((s) => s.sourceId === sourceId);
    return set
      ? { ...set, tracks: set.tracks.map((t) => ({ ...t, trackId: demoTrackId(t) })) }
      : null;
  }
  await connection();

  const [row] = await db()
    .select()
    .from(schema.sets)
    .where(and(eq(schema.sets.source, "mixesdb"), eq(schema.sets.sourceId, sourceId)));
  if (row && isFresh(row.tracksFetchedAt, TRACKLIST_TTL)) return loadSetView(row);

  const detail = await mixesdb.getSet(sourceId);
  if (!detail) return null;
  return saveSet(detail);
}

async function loadSetView(row: typeof schema.sets.$inferSelect): Promise<SetView> {
  const rows = await db()
    .select()
    .from(schema.setTracks)
    .where(eq(schema.setTracks.setId, row.id))
    .orderBy(asc(schema.setTracks.position));

  return {
    ...rowToSummary(row),
    genres: row.genres,
    isComplete: row.isComplete,
    // Re-parsing the stored line is cheap and keeps one source of truth for the format.
    tracks: rows.map((st) => ({
      ...parseTrackLine(st.rawLine, st.position, st.section),
      trackId: st.trackId,
    })),
  };
}

async function saveSet(detail: SetDetail): Promise<SetView> {
  const { tracks, ...meta } = detail;
  const [setRow] = await db()
    .insert(schema.sets)
    .values({ ...meta, tracksFetchedAt: new Date() })
    .onConflictDoUpdate({
      target: [schema.sets.source, schema.sets.sourceId],
      set: {
        ...meta,
        fetchedAt: sql`now()`,
        tracksFetchedAt: sql`now()`,
      },
    })
    .returning();

  // Dedupe within the set before upserting: the same track can appear twice.
  const keyed = new Map<string, ParsedTrack>();
  for (const t of tracks) {
    if (t.kind === "track" && t.artist && t.title)
      keyed.set(trackKey(t.artist, t.title, t.mixName), t);
  }

  const idByKey = new Map<string, number>();
  if (keyed.size > 0) {
    const inserted = await db()
      .insert(schema.tracks)
      .values(
        [...keyed].map(([key, t]) => ({
          artist: t.artist!,
          title: t.title!,
          mixName: t.mixName,
          label: t.label,
          catalogNo: t.catalogNo,
          isUnreleased: t.isUnreleased,
          normalizedKey: key,
        })),
      )
      .onConflictDoUpdate({
        target: schema.tracks.normalizedKey,
        set: {
          label: sql`coalesce(excluded.label, ${schema.tracks.label})`,
          catalogNo: sql`coalesce(excluded.catalog_no, ${schema.tracks.catalogNo})`,
        },
      })
      .returning({ id: schema.tracks.id, key: schema.tracks.normalizedKey });
    for (const r of inserted) idByKey.set(r.key, r.id);
  }

  const withIds: SetTrack[] = tracks.map((t) => ({
    ...t,
    trackId:
      t.kind === "track" && t.artist && t.title
        ? (idByKey.get(trackKey(t.artist, t.title, t.mixName)) ?? null)
        : null,
  }));

  await db().batch([
    db().delete(schema.setTracks).where(eq(schema.setTracks.setId, setRow.id)),
    ...(withIds.length
      ? [
          db()
            .insert(schema.setTracks)
            .values(
              withIds.map((t) => ({
                setId: setRow.id,
                position: t.position,
                trackId: t.trackId,
                section: t.section,
                cueSec: t.cueSec,
                isMashupPart: t.isMashupPart,
                rawLine: t.rawLine,
              })),
            ),
        ]
      : []),
  ]);

  return { ...meta, tracks: withIds };
}
