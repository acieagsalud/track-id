import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isDemo } from "@/lib/env";
import { SpotifyError } from "@/lib/spotify/client";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Spotify-backed endpoints need a signed-in user so anonymous traffic can't burn the shared quota. */
export async function requireSpotifyUser(): Promise<string> {
  const session = await auth();
  const id = session?.user?.spotifyId;
  if (!id) throw new HttpError(401, "Sign in with Spotify first");
  return id;
}

export function requireLive() {
  if (isDemo()) throw new HttpError(403, "Not available in demo mode");
}

export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, z.prettifyError(parsed.error));
  return parsed.data;
}

export function parseTrackId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Invalid track id");
  return id;
}

export function handle(fn: () => Promise<unknown>) {
  return fn().then(
    (data) => NextResponse.json(data),
    (err: unknown) => {
      if (err instanceof HttpError)
        return NextResponse.json({ error: err.message }, { status: err.status });
      if (err instanceof SpotifyError) {
        console.error(err);
        if (err.status === 401)
          return NextResponse.json(
            { error: "Your Spotify session expired. Sign in again." },
            { status: 401 },
          );
        if (err.status === 429)
          return NextResponse.json(
            { error: "Spotify is rate limiting requests. Try again in a minute." },
            { status: 429 },
          );
        return NextResponse.json({ error: "Spotify request failed" }, { status: 502 });
      }
      console.error(err);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    },
  );
}
