import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ExternalLink } from "lucide-react";
import { SpotifySignInButton } from "@/components/auth-button";
import { SetListSkeleton } from "@/components/set-card";
import { auth } from "@/lib/auth";
import { listPlaylists } from "@/lib/data/playlist";
import { isDemo } from "@/lib/env";

export const metadata: Metadata = { title: "My playlists" };

export default function PlaylistsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">My playlists</h1>
      <Suspense fallback={<SetListSkeleton />}>
        <Playlists />
      </Suspense>
    </div>
  );
}

async function Playlists() {
  if (isDemo()) {
    return (
      <p className="text-muted-foreground">
        Saved playlists appear here when you sign in with Spotify.
      </p>
    );
  }
  const spotifyId = (await auth())?.user?.spotifyId;
  if (!spotifyId) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-muted-foreground">Sign in to see the playlists you&apos;ve saved.</p>
        <SpotifySignInButton redirectTo="/playlists" />
      </div>
    );
  }

  const playlists = await listPlaylists(spotifyId);
  if (playlists.length === 0) {
    return (
      <p className="text-muted-foreground">
        Nothing saved yet.{" "}
        <Link href="/" className="text-foreground underline underline-offset-2">
          Find a set
        </Link>{" "}
        and press “Save to Spotify”.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {playlists.map((p) => (
        <li key={p.url} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <Link href={`/set/${p.setSourceId}`} className="font-medium hover:underline">
              {p.name}
            </Link>
            <p className="text-muted-foreground text-sm">
              {p.trackCount} tracks
              {p.skippedCount > 0 && ` · ${p.skippedCount} skipped`} · saved{" "}
              {p.createdAt.toISOString().slice(0, 10)}
            </p>
          </div>
          <a
            href={p.url}
            target="_blank"
            rel="noreferrer"
            className="text-brand inline-flex items-center gap-1 text-sm underline underline-offset-2"
          >
            Open in Spotify <ExternalLink className="size-3" aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  );
}
