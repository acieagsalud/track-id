"use client";

import { useState } from "react";
import { ExternalLink, ListMusic, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { SaveResult } from "@/lib/data/playlist";
import { useMatches } from "./match-provider";

const REASON: Record<SaveResult["skipped"][number]["reason"], string> = {
  unreleased: "Unreleased",
  unidentified: "Unidentified",
  not_found: "Not on Spotify",
};

export function SavePlaylist({
  setId,
  lastSavedUrl,
}: {
  setId: string;
  lastSavedUrl: string | null;
}) {
  const { pending, matches } = useMatches();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);
  const matching = pending.size > 0;
  const found = Object.values(matches).filter((m) => m.status !== "not_found").length;

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/sets/${setId}/playlist`, { method: "POST" });
      const body = (await res.json()) as SaveResult & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Save failed");
      setResult(body);
      if (body.url) toast.success(`Saved “${body.name}” to Spotify`);
      else if (body.added === 0) toast.error("None of these tracks are on Spotify.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={save}
          disabled={busy || matching || found === 0}
          className="bg-brand text-brand-foreground hover:bg-brand/90"
        >
          {busy || matching ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <ListMusic aria-hidden />
          )}
          {matching ? "Matching tracks…" : busy ? "Saving…" : "Save to Spotify"}
        </Button>
        {!matching && found > 0 && (
          <span className="text-muted-foreground text-sm">{found} tracks will be added</span>
        )}
        {lastSavedUrl && !result && (
          <a
            href={lastSavedUrl}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground inline-flex items-center gap-1 text-sm underline underline-offset-2"
          >
            Open your last saved copy <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
      </div>

      {result && (
        <div className="space-y-2 rounded-lg border p-4 text-sm" role="status">
          <p className="font-medium">
            {result.demo
              ? `Demo: this would create “${result.name}” with ${result.added} tracks.`
              : result.url
                ? `Created “${result.name}” with ${result.added} tracks.`
                : "Nothing to save: none of these tracks are on Spotify."}
          </p>
          {result.url && (
            <a
              href={result.url}
              target="_blank"
              rel="noreferrer"
              className="text-brand inline-flex items-center gap-1 underline underline-offset-2"
            >
              Open in Spotify <ExternalLink className="size-3" aria-hidden />
            </a>
          )}
          {result.skipped.length > 0 && (
            <details>
              <summary className="text-muted-foreground cursor-pointer">
                {result.skipped.length} skipped
              </summary>
              <ul className="mt-2 space-y-1">
                {result.skipped.map((s) => (
                  <li key={s.position} className="flex justify-between gap-3">
                    <span className="truncate">
                      <span className="text-muted-foreground font-mono text-xs">{s.position}.</span>{" "}
                      {s.label}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {REASON[s.reason]}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
