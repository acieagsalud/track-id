import { z } from "zod";
import { handle, parseBody, requireSpotifyUser } from "@/lib/api";
import { matchTracks } from "@/lib/data/match";
import { isDemo } from "@/lib/env";

const body = z.object({ trackIds: z.array(z.number().int().positive()).min(1).max(10) });

/** Matches up to 10 tracks; the client calls this in batches so rows fill in progressively. */
export function POST(req: Request) {
  return handle(async () => {
    if (!isDemo()) await requireSpotifyUser();
    const { trackIds } = await parseBody(req, body);
    return { matches: await matchTracks(trackIds) };
  });
}
