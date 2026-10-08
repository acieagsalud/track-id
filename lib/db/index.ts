import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "@/lib/env";
import * as schema from "./schema";

let client: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function db() {
  const url = env().DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (demo mode should not touch the DB)");
  client ??= drizzle(neon(url), { schema });
  return client;
}

export { schema };
