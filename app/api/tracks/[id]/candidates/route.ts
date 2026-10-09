import { handle, requireLive, requireSpotifyUser, parseTrackId } from "@/lib/api";
import { getCandidates } from "@/lib/data/match";

export function POST(_req: Request, ctx: RouteContext<"/api/tracks/[id]/candidates">) {
  return handle(async () => {
    requireLive();
    await requireSpotifyUser();
    const id = parseTrackId((await ctx.params).id);
    return { candidates: await getCandidates(id) };
  });
}
