import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { SetList, SetListSkeleton } from "@/components/set-card";
import { SortControl } from "@/components/sort-control";
import { searchSets } from "@/lib/data/sets";
import { djHref } from "@/lib/format";
import { normalize } from "@/lib/normalize";
import { parseSort, sortSets } from "@/lib/sort";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage(props: PageProps<"/search">) {
  return (
    <Suspense fallback={<SetListSkeleton />}>
      <Results searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/search">, "searchParams">) {
  const { q, sort: rawSort } = await searchParams;
  const sort = parseSort(rawSort);
  const query = (Array.isArray(q) ? q[0] : q)?.trim() ?? "";
  if (!query) return <p className="text-muted-foreground">Type a DJ, event or track to search.</p>;

  const sets = sortSets(await searchSets(query), sort);
  // If the query names a DJ who appears in the results, offer their full set list.
  const dj = sets.flatMap((s) => s.djs).find((d) => normalize(d) === normalize(query));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold">
          Results for <span className="text-brand">“{query}”</span>
        </h1>
        {dj && (
          <Link
            href={djHref(dj)}
            className="flex items-center gap-1 text-sm underline underline-offset-2"
          >
            All sets by {dj} <ArrowRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
      {sets.length > 1 && <SortControl query={query} current={sort} />}
      {sets.length ? (
        <SetList sets={sets} />
      ) : (
        <p className="text-muted-foreground">
          No sets found. MixesDB titles look like “2021-03-06 - Solomun - Sputnik Club”, so try a DJ
          name or event.
        </p>
      )}
    </div>
  );
}
