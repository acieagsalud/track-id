import { HttpError, handle, requireSpotifyUser } from "@/lib/api";
import { saveSetAsPlaylist } from "@/lib/data/playlist";
import { isDemo } from "@/lib/env";

/** Creates a private Spotify playlist from the set (demo mode returns a preview only). */
export function POST(_req: Request, ctx: RouteContext<"/api/sets/[id]/playlist">) {
  return handle(async () => {
    const userId = isDemo() ? null : await requireSpotifyUser();
    const { id } = await ctx.params;
    if (!/^\d+$/.test(id)) throw new HttpError(400, "Invalid set id");
    const result = await saveSetAsPlaylist(userId, id);
    if (!result) throw new HttpError(404, "Set not found");
    return result;
  });
}
