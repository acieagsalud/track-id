import {
  categoriesToMeta,
  pageUrl,
  parseSetTitle,
  parseTracklist,
} from "@/lib/sources/mixesdb/parse";
import type { SetDetail } from "@/lib/sources/types";
import p113019 from "@/lib/sources/mixesdb/__fixtures__/page-113019.json";
import p143558 from "@/lib/sources/mixesdb/__fixtures__/page-143558.json";
import p264926 from "@/lib/sources/mixesdb/__fixtures__/page-264926.json";
import p429384 from "@/lib/sources/mixesdb/__fixtures__/page-429384.json";
import p770688 from "@/lib/sources/mixesdb/__fixtures__/page-770688.json";

type Page = {
  parse: { title: string; pageid: number; wikitext: string; categories: { category: string }[] };
};

/** Real MixesDB pages bundled with the app, so demo mode needs no network or DB. */
export const DEMO_SETS: SetDetail[] = ([p264926, p113019, p770688, p429384, p143558] as Page[]).map(
  ({ parse: p }) => ({
    source: "mixesdb",
    sourceId: String(p.pageid),
    title: p.title,
    sourceUrl: pageUrl(p.title),
    ...parseSetTitle(p.title),
    ...categoriesToMeta(p.categories.map((c) => c.category)),
    tracks: parseTracklist(p.wikitext),
  }),
);
