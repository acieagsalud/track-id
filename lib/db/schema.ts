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

export const djs = pgTable("djs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  sourceCategory: text("source_category"),
  imageUrl: text("image_url"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sets = pgTable(
  "sets",
  {
    id: serial("id").primaryKey(),
    source: sourceEnum("source").notNull(),
    sourceId: text("source_id").notNull(),
    djId: integer("dj_id").references(() => djs.id),
    title: text("title").notNull(),
    venue: text("venue"),
    event: text("event"),
    playedAt: text("played_at"), // MixesDB dates can be partial ("2013", "201X")
    genres: text("genres").array().notNull().default([]),
    isComplete: boolean("is_complete").notNull().default(false),
    sourceUrl: text("source_url").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
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
