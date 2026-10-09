/**
 * Records Spotify matches for the bundled demo sets into lib/demo-matches.json, so demo mode
 * can show real match results without a database, login or Spotify credentials at runtime.
 *
 *   npm run demo:record   (needs AUTH_SPOTIFY_ID / AUTH_SPOTIFY_SECRET in .env.local)
 */
import { writeFileSync } from "node:fs";
import type { MatchView } from "@/lib/data/match";
import { DEMO_SETS } from "@/lib/demo";
import { trackKey } from "@/lib/normalize";
import { bestMatch, buildQueries, type SpotifyTrack } from "@/lib/spotify/match";

process.loadEnvFile(".env.local");
const { AUTH_SPOTIFY_ID: id, AUTH_SPOTIFY_SECRET: secret } = process.env;
if (!id || !secret) throw new Error("Set AUTH_SPOTIFY_ID and AUTH_SPOTIFY_SECRET in .env.local");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function appToken(): Promise<string> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`token: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function search(token: string, q: string): Promise<SpotifyTrack[]> {
  const params = new URLSearchParams({ q, type: "track", limit: "10" });
  const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`search "${q}": ${res.status} ${await res.text()}`);
  await sleep(150); // stay gentle with the shared dev-mode quota
  const data = (await res.json()) as { tracks: { items: (SpotifyTrack | null)[] } };
  return data.tracks.items.filter((t): t is SpotifyTrack => t !== null);
}

const token = await appToken();
const out: Record<string, MatchView> = {};
let matched = 0;

for (const set of DEMO_SETS) {
  for (const t of set.tracks) {
    if (t.kind !== "track" || !t.artist || !t.title || t.isUnreleased) continue;
    const key = trackKey(t.artist, t.title, t.mixName);
    if (out[key]) continue;

    const input = { artist: t.artist, title: t.title, mixName: t.mixName };
    const [strict, loose] = buildQueries(input);
    const first = await search(token, strict);
    const best =
      bestMatch(input, first) ?? bestMatch(input, [...first, ...(await search(token, loose))]);

    out[key] = best
      ? {
          status: "matched",
          spotifyUri: best.track.uri,
          spotifyName: best.track.name,
          spotifyArtists: best.track.artists.map((a) => a.name).join(", "),
          albumArtUrl:
            [...best.track.album.images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0))[0]?.url ??
            null,
          confidence: Math.round(best.score * 100) / 100,
        }
      : {
          status: "not_found",
          spotifyUri: null,
          spotifyName: null,
          spotifyArtists: null,
          albumArtUrl: null,
          confidence: null,
        };
    if (best) matched++;
  }
}

// Sorted keys keep diffs small when re-recording.
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync("lib/demo-matches.json", JSON.stringify(sorted, null, 2) + "\n");
console.log(
  `Recorded ${Object.keys(out).length} tracks (${matched} matched) → lib/demo-matches.json`,
);
