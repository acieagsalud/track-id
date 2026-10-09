import type { SetSummary } from "@/lib/sources/types";

export const SORTS = {
  newest: "Newest",
  oldest: "Oldest",
  relevance: "Relevance",
} as const;

export type SortKey = keyof typeof SORTS;
export const DEFAULT_SORT: SortKey = "newest";

export function parseSort(raw: string | string[] | undefined): SortKey {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && v in SORTS ? (v as SortKey) : DEFAULT_SORT;
}

/**
 * Comparable key for MixesDB's partial dates: "2021-03-06" stays as is, "2013" → "2013-00-00",
 * "201X" → "2010-00-00", "20XX" → "2000-00-00". Unknown dates return null.
 */
export function dateKey(playedAt: string | null): string | null {
  const m = playedAt?.match(/^(\d{2}[\dX]{2})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (!m) return null;
  return `${m[1].replace(/X/g, "0")}-${m[2] ?? "00"}-${m[3] ?? "00"}`;
}

/**
 * Like `dateKey`, but when the date is partial ("201X") prefer a full date in the title that fits
 * it, e.g. "201X - Solomun @ Ego - RA Podcast (RA.360, 2013-04-22)" sorts as 2013-04-22.
 */
export function sortDate(set: Pick<SetSummary, "playedAt" | "title">): string | null {
  const key = dateKey(set.playedAt);
  if (!set.playedAt || /^\d{4}-\d{2}-\d{2}$/.test(set.playedAt)) return key;
  const prefix = new RegExp(`^${set.playedAt.replace(/X/g, "\\d")}`);
  const full = set.title.match(/\b\d{4}-\d{2}-\d{2}\b/g)?.find((d) => prefix.test(d));
  return full ?? key;
}

/** Sorts a copy. Sets without a usable date go last; ties keep the source's relevance order. */
export function sortSets(sets: SetSummary[], sort: SortKey): SetSummary[] {
  if (sort === "relevance") return sets;
  const dir = sort === "newest" ? -1 : 1;
  return sets
    .map((set, i) => ({ set, i, key: sortDate(set) }))
    .sort((a, b) => {
      if (a.key === b.key) return a.i - b.i;
      if (a.key === null) return 1;
      if (b.key === null) return -1;
      return a.key < b.key ? -dir : dir;
    })
    .map((x) => x.set);
}
