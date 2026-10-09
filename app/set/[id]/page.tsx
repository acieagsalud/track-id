import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SpotifySignInButton } from "@/components/auth-button";
import { MatchProvider } from "@/components/match-provider";
import { SavePlaylist } from "@/components/save-playlist";
import { Tracklist, TracklistSkeleton } from "@/components/tracklist";
import { auth } from "@/lib/auth";
import { getMatches } from "@/lib/data/match";
import { lastSavedFor } from "@/lib/data/playlist";
import { isDemo } from "@/lib/env";
import { getSet, matchableIds } from "@/lib/data/sets";
import { djHref } from "@/lib/format";

export default function SetPage(props: PageProps<"/set/[id]">) {
  return (
    <Suspense fallback={<TracklistSkeleton />}>
      <SetDetail params={props.params} />
    </Suspense>
  );
}

async function SetDetail({ params }: Pick<PageProps<"/set/[id]">, "params">) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const set = await getSet(id);
  if (!set) notFound();

  const demo = isDemo();
  const spotifyId = demo ? undefined : (await auth())?.user?.spotifyId;
  const signedIn = !!spotifyId;
  const ids = matchableIds(set.tracks);
  const [initial, lastSaved] = await Promise.all([
    getMatches(ids),
    spotifyId ? lastSavedFor(spotifyId, id) : null,
  ]);

  const playable = set.tracks.filter((t) => t.kind === "track" && !t.isUnreleased).length;
  const missing = set.tracks.filter((t) => t.kind === "unknown" || t.isUnreleased).length;

  return (
    <article className="space-y-8">
      <title>{set.title}</title>
      <header className="space-y-3">
        <p className="text-muted-foreground text-sm">
          {[set.playedAt, set.venue].filter(Boolean).join(" · ")}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {set.djs.length
            ? set.djs.map((d, i) => (
                <span key={d}>
                  {i > 0 && <span className="text-muted-foreground"> & </span>}
                  <Link href={djHref(d)} className="hover:underline">
                    {d}
                  </Link>
                </span>
              ))
            : set.title}
        </h1>
        {set.event && <p className="text-lg">{set.event}</p>}
        <div className="flex flex-wrap items-center gap-2">
          {set.genres.map((g) => (
            <Badge key={g} variant="secondary">
              {g}
            </Badge>
          ))}
          <Badge variant="outline">
            {set.isComplete ? "Complete tracklist" : "Partial tracklist"}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          {set.tracks.length} tracks · {playable} identified
          {missing > 0 && ` · ${missing} unreleased or unknown`} ·{" "}
          <a
            href={set.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 underline underline-offset-2"
          >
            View on MixesDB <ExternalLink className="size-3" aria-hidden />
          </a>
        </p>
      </header>

      {!demo && !signedIn && ids.some((id) => !initial[id]) && (
        <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
          <p className="text-sm">
            Sign in with Spotify to match these tracks and save the set as a playlist.
          </p>
          <SpotifySignInButton redirectTo={`/set/${id}`} />
        </div>
      )}

      {set.tracks.length ? (
        <MatchProvider
          trackIds={ids}
          initial={initial}
          canMatch={demo || signedIn}
          canEdit={signedIn}
          signedIn={signedIn}
        >
          {(demo || signedIn) && ids.length > 0 && (
            <SavePlaylist setId={id} lastSavedUrl={lastSaved?.url ?? null} />
          )}
          <Tracklist tracks={set.tracks} />
        </MatchProvider>
      ) : (
        <p className="text-muted-foreground">
          MixesDB doesn&apos;t have a tracklist for this set yet.
        </p>
      )}
    </article>
  );
}
