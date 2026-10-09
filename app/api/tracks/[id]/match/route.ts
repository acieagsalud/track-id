import { z } from "zod";
import { handle, parseBody, requireLive, requireSpotifyUser, parseTrackId } from "@/lib/api";
import { setManualMatch } from "@/lib/data/match";

const body = z.object({
  spotifyTrackId: z
    .string()
    .regex(/^[A-Za-z0-9]{22}$/)
    .nullable(),
});

export function PUT(req: Request, ctx: RouteContext<"/api/tracks/[id]/match">) {
  return handle(async () => {
    requireLive();
    await requireSpotifyUser();
    const id = parseTrackId((await ctx.params).id);
    const { spotifyTrackId } = await parseBody(req, body);
    return { match: await setManualMatch(id, spotifyTrackId) };
  });
}
