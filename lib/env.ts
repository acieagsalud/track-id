import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.url().optional(),
  AUTH_SECRET: z.string().min(32).optional(),
  AUTH_SPOTIFY_ID: z.string().optional(),
  AUTH_SPOTIFY_SECRET: z.string().optional(),
  // Sent in the User-Agent so MixesDB admins can reach us.
  MIXESDB_CONTACT: z.email().optional(),
  NEXT_PUBLIC_DEMO: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  cached ??= schema.parse(process.env);
  return cached;
}

/** Demo mode serves bundled fixture data and never calls MixesDB, Spotify, or the DB. */
export function isDemo(): boolean {
  const e = env();
  return e.NEXT_PUBLIC_DEMO || !e.DATABASE_URL;
}
