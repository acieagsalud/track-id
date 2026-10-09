import "server-only";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { decrypt, encrypt } from "@/lib/crypto";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import type { SpotifyTrack } from "./match";

const API = "https://api.spotify.com/v1";
const TOKEN_URL = "https://accounts.spotify.com/api/token";

export class SpotifyError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const tokenSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
});

function basicAuth() {
  const { AUTH_SPOTIFY_ID: id, AUTH_SPOTIFY_SECRET: secret } = env();
  if (!id || !secret) throw new Error("Spotify credentials are not configured");
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!res.ok) throw new SpotifyError(res.status, `token request failed: ${await res.text()}`);
  return tokenSchema.parse(await res.json());
}

// App token (client credentials) for search; reused until a minute before expiry.
let appToken: { value: string; expiresAt: number } | undefined;

async function getAppToken(): Promise<string> {
  if (appToken && appToken.expiresAt > Date.now() + 60_000) return appToken.value;
  const t = await tokenRequest({ grant_type: "client_credentials" });
  appToken = { value: t.access_token, expiresAt: Date.now() + t.expires_in * 1000 };
  return appToken.value;
}

async function call<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    // Respect Retry-After once; quota is shared across the whole developer account.
    if (res.status === 429 && attempt === 0) {
      const wait = Math.min(Number(res.headers.get("Retry-After") ?? 1), 10);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    if (!res.ok)
      throw new SpotifyError(res.status, `${init.method ?? "GET"} ${path}: ${await res.text()}`);
    return (res.status === 204 ? undefined : await res.json()) as T;
  }
}

export async function searchTracks(q: string): Promise<SpotifyTrack[]> {
  const params = new URLSearchParams({ q, type: "track", limit: "10" });
  const data = await call<{ tracks: { items: (SpotifyTrack | null)[] } }>(
    await getAppToken(),
    `/search?${params}`,
  );
  return data.tracks.items.filter((t): t is SpotifyTrack => t !== null);
}

export async function getTrack(id: string): Promise<SpotifyTrack> {
  if (!/^[A-Za-z0-9]{22}$/.test(id)) throw new SpotifyError(400, "Invalid Spotify track id");
  return call<SpotifyTrack>(await getAppToken(), `/tracks/${id}`);
}

// ---- User tokens (stored encrypted, refreshed on demand) ----

export async function saveUserTokens(
  spotifyUserId: string,
  t: { accessToken: string; refreshToken: string; expiresAt: Date },
) {
  const values = {
    spotifyUserId,
    accessTokenEnc: encrypt(t.accessToken),
    refreshTokenEnc: encrypt(t.refreshToken),
    expiresAt: t.expiresAt,
  };
  await db()
    .insert(schema.spotifyAccounts)
    .values(values)
    .onConflictDoUpdate({
      target: schema.spotifyAccounts.spotifyUserId,
      set: { ...values, updatedAt: sql`now()` },
    });
}

/** Tokens written under a different AUTH_SECRET can't be read; ask the user to sign in again. */
function decryptOrReauth(enc: string): string {
  try {
    return decrypt(enc);
  } catch {
    throw new SpotifyError(401, "Stored Spotify tokens are unreadable; sign in again");
  }
}

export async function getUserToken(spotifyUserId: string): Promise<string> {
  const [row] = await db()
    .select()
    .from(schema.spotifyAccounts)
    .where(eq(schema.spotifyAccounts.spotifyUserId, spotifyUserId));
  if (!row) throw new SpotifyError(401, "No Spotify tokens; sign in again");
  if (row.expiresAt.getTime() > Date.now() + 60_000) return decryptOrReauth(row.accessTokenEnc);

  const refreshToken = decryptOrReauth(row.refreshTokenEnc);
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
  await saveUserTokens(spotifyUserId, {
    accessToken: t.access_token,
    refreshToken: t.refresh_token ?? refreshToken, // Spotify may not rotate it
    expiresAt: new Date(Date.now() + t.expires_in * 1000),
  });
  return t.access_token;
}

export function userApi(token: string) {
  return {
    createPlaylist: (body: { name: string; description: string; public: boolean }) =>
      call<{ id: string; external_urls: { spotify: string } }>(token, "/me/playlists", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    addItems: (playlistId: string, uris: string[]) =>
      call<{ snapshot_id: string }>(token, `/playlists/${playlistId}/items`, {
        method: "POST",
        body: JSON.stringify({ uris }),
      }),
  };
}
