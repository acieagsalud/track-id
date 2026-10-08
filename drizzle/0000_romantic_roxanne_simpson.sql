CREATE TYPE "public"."match_status" AS ENUM('matched', 'not_found', 'manual');--> statement-breakpoint
CREATE TYPE "public"."source" AS ENUM('mixesdb', 'mixcloud');--> statement-breakpoint
CREATE TABLE "djs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"set_source_ids" text[] DEFAULT '{}' NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "djs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "searches" (
	"query" text PRIMARY KEY NOT NULL,
	"set_source_ids" text[] DEFAULT '{}' NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "set_tracks" (
	"set_id" integer NOT NULL,
	"position" integer NOT NULL,
	"track_id" integer,
	"section" text,
	"cue_sec" integer,
	"is_mashup_part" boolean DEFAULT false NOT NULL,
	"raw_line" text NOT NULL,
	CONSTRAINT "set_tracks_set_id_position_pk" PRIMARY KEY("set_id","position")
);
--> statement-breakpoint
CREATE TABLE "sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" "source" NOT NULL,
	"source_id" text NOT NULL,
	"title" text NOT NULL,
	"djs" text[] DEFAULT '{}' NOT NULL,
	"venue" text,
	"event" text,
	"played_at" text,
	"genres" text[] DEFAULT '{}' NOT NULL,
	"is_complete" boolean DEFAULT false NOT NULL,
	"source_url" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tracks_fetched_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "spotify_matches" (
	"track_id" integer PRIMARY KEY NOT NULL,
	"spotify_track_id" text,
	"spotify_uri" text,
	"confidence" real,
	"status" "match_status" NOT NULL,
	"album_art_url" text,
	"preview_url" text,
	"matched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist" text NOT NULL,
	"title" text NOT NULL,
	"mix_name" text,
	"label" text,
	"catalog_no" text,
	"is_unreleased" boolean DEFAULT false NOT NULL,
	"normalized_key" text NOT NULL,
	CONSTRAINT "tracks_normalized_key_unique" UNIQUE("normalized_key")
);
--> statement-breakpoint
CREATE TABLE "user_playlists" (
	"id" serial PRIMARY KEY NOT NULL,
	"spotify_user_id" text NOT NULL,
	"set_id" integer NOT NULL,
	"spotify_playlist_id" text NOT NULL,
	"url" text NOT NULL,
	"track_count" integer NOT NULL,
	"skipped_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "set_tracks" ADD CONSTRAINT "set_tracks_set_id_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set_tracks" ADD CONSTRAINT "set_tracks_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotify_matches" ADD CONSTRAINT "spotify_matches_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_playlists" ADD CONSTRAINT "user_playlists_set_id_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sets_source_idx" ON "sets" USING btree ("source","source_id");