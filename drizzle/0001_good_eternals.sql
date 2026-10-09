CREATE TABLE "spotify_accounts" (
	"spotify_user_id" text PRIMARY KEY NOT NULL,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "spotify_matches" ADD COLUMN "spotify_name" text;--> statement-breakpoint
ALTER TABLE "spotify_matches" ADD COLUMN "spotify_artists" text;