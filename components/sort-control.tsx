import Link from "next/link";
import { ArrowDownUp } from "lucide-react";
import { DEFAULT_SORT, SORTS, type SortKey } from "@/lib/sort";
import { cn } from "@/lib/utils";

/** Plain links (no client JS): the sort lives in the URL so results stay shareable. */
export function SortControl({ query, current }: { query: string; current: SortKey }) {
  return (
    <nav aria-label="Sort results" className="flex items-center gap-2 text-sm">
      <ArrowDownUp className="text-muted-foreground size-4" aria-hidden />
      <div className="bg-muted/40 flex rounded-lg border p-0.5">
        {(Object.keys(SORTS) as SortKey[]).map((key) => {
          const params = new URLSearchParams({ q: query });
          if (key !== DEFAULT_SORT) params.set("sort", key);
          const active = key === current;
          return (
            <Link
              key={key}
              href={`/search?${params}`}
              aria-current={active ? "true" : undefined}
              scroll={false}
              className={cn(
                "focus-visible:ring-ring/50 rounded-md px-2.5 py-1 outline-none focus-visible:ring-3",
                active
                  ? "bg-background text-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {SORTS[key]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
