import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import type { SetSummary } from "@/lib/sources/types";

export function SetCard({ set }: { set: SetSummary }) {
  const djs = set.djs.length ? set.djs.join(", ") : "Various artists";
  return (
    <li>
      <Link
        href={`/set/${set.sourceId}`}
        className="hover:bg-muted/50 focus-visible:ring-ring/50 block rounded-lg border p-4 transition-colors outline-none focus-visible:ring-3"
      >
        <p className="font-medium">{djs}</p>
        {set.event && <p className="text-muted-foreground text-sm">{set.event}</p>}
        <p className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {set.playedAt && (
            <span className="flex items-center gap-1">
              <CalendarDays className="size-3.5" aria-hidden />
              {set.playedAt}
            </span>
          )}
          {set.venue && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" aria-hidden />
              {set.venue}
            </span>
          )}
        </p>
      </Link>
    </li>
  );
}

export function SetList({ sets }: { sets: SetSummary[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {sets.map((s) => (
        <SetCard key={s.sourceId} set={s} />
      ))}
    </ul>
  );
}

export function SetListSkeleton() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2" aria-busy="true" aria-label="Loading sets">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="bg-muted/40 h-[92px] animate-pulse rounded-lg border" />
      ))}
    </ul>
  );
}
