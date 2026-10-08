import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const sourceEnum = pgEnum("source", ["mixesdb", "mixcloud"]);
export const matchStatusEnum = pgEnum("match_status", ["matched", "not_found", "manual"]);

/** A DJ's set list, cached in source order (newest first). */
export const djs = pgTable("djs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  setSourceIds: text("set_source_ids").array().notNull().default([]),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Cached search results, keyed by normalized query. */
export const searches = pgTable("searches", {
  query: text("query").primaryKey(),
  setSourceIds: text("set_source_ids").array().notNull().default([]),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sets = pgTable(
  "sets",
  {
    id: serial("id").primaryKey(),
    source: sourceEnum("source").notNull(),
    sourceId: text("source_id").notNull(),
    title: text("title").notNull(),
    djs: text("djs").array().notNull().default([]), // b2b sets have several
    venue: text("venue"),
    event: text("event"),
    playedAt: text("played_at"), // MixesDB dates can be partial ("2013", "201X")
    genres: text("genres").array().notNull().default([]),
    isComplete: boolean("is_complete").notNull().default(false),
    sourceUrl: text("source_url").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    // Null until the tracklist itself has been fetched (search only gives titles).
    tracksFetchedAt: timestamp("tracks_fetched_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("sets_source_idx").on(t.source, t.sourceId)],
);

export const tracks = pgTable("tracks", {
  id: serial("id").primaryKey(),
  artist: text("artist").notNull(),
  title: text("title").notNull(),
  mixName: text("mix_name"),
  label: text("label"),
  catalogNo: text("catalog_no"),
  isUnreleased: boolean("is_unreleased").notNull().default(false),
  normalizedKey: text("normalized_key").notNull().unique(),
});

export const setTracks = pgTable(
  "set_tracks",
  {
    setId: integer("set_id")
      .notNull()
      .references(() => sets.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    // Null for "?" / note lines, which have no track to match.
    trackId: integer("track_id").references(() => tracks.id),
    section: text("section"),
    cueSec: integer("cue_sec"),
    isMashupPart: boolean("is_mashup_part").notNull().default(false),
    rawLine: text("raw_line").notNull(),
  },
  (t) => [primaryKey({ columns: [t.setId, t.position] })],
);

export const spotifyMatches = pgTable("spotify_matches", {
  trackId: integer("track_id")
    .primaryKey()
    .references(() => tracks.id, { onDelete: "cascade" }),
  spotifyTrackId: text("spotify_track_id"),
  spotifyUri: text("spotify_uri"),
  confidence: real("confidence"),
  status: matchStatusEnum("status").notNull(),
  albumArtUrl: text("album_art_url"),
  previewUrl: text("preview_url"),
  matchedAt: timestamp("matched_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userPlaylists = pgTable("user_playlists", {
  id: serial("id").primaryKey(),
  spotifyUserId: text("spotify_user_id").notNull(),
  setId: integer("set_id")
    .notNull()
    .references(() => sets.id),
  spotifyPlaylistId: text("spotify_playlist_id").notNull(),
  url: text("url").notNull(),
  trackCount: integer("track_count").notNull(),
  skippedCount: integer("skipped_count").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
