import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import { createThrottle } from "@/lib/throttle";
import type { SetDetail, SetSummary, TracklistSource } from "../types";
import { MIXESDB_BASE, categoriesToMeta, pageUrl, parseSetTitle, parseTracklist } from "./parse";

// robots.txt asks for Crawl-delay: 4.
const throttle = createThrottle(4000);

const searchSchema = z.object({
  query: z.object({
    search: z.array(z.object({ pageid: z.number(), title: z.string() })),
  }),
});

const categoryMembersSchema = z.object({
  query: z.object({
    categorymembers: z.array(z.object({ pageid: z.number(), ns: z.number(), title: z.string() })),
  }),
});

const parseSchema = z.object({
  parse: z.object({
    title: z.string(),
    pageid: z.number(),
    wikitext: z.string(),
    categories: z.array(z.object({ category: z.string() })),
  }),
});

const errorSchema = z.object({ error: z.object({ code: z.string(), info: z.string() }) });

async function api<T>(params: Record<string, string>, schema: z.ZodType<T>): Promise<T | null> {
  const qs = new URLSearchParams({ ...params, format: "json", formatversion: "2" });
  const contact = env().MIXESDB_CONTACT;
  const res = await throttle(() =>
    fetch(`${MIXESDB_BASE}/w/api.php?${qs}`, {
      headers: {
        "User-Agent": `track-id/0.1 (DJ tracklist to Spotify playlist portfolio app${contact ? `; ${contact}` : ""})`,
      },
    }),
  );
  if (!res.ok) throw new Error(`MixesDB ${res.status} for ${params.action}`);
  const json: unknown = await res.json();
  if (errorSchema.safeParse(json).success) return null; // e.g. missingtitle / nosuchpageid
  return schema.parse(json);
}

function toSummary(pageid: number, title: string): SetSummary {
  return {
    source: "mixesdb",
    sourceId: String(pageid),
    title,
    sourceUrl: pageUrl(title),
    ...parseSetTitle(title),
  };
}

export const mixesdb: TracklistSource = {
  name: "mixesdb",

  async search(query, limit = 20) {
    const data = await api(
      {
        action: "query",
        list: "search",
        srsearch: query,
        srlimit: String(limit),
        srnamespace: "0",
      },
      searchSchema,
    );
    return (data?.query.search ?? [])
      .map((r) => toSummary(r.pageid, r.title))
      .filter((s) => s.playedAt !== null); // drop non-set pages (artist bios, labels, …)
  },

  async getSetsByDj(dj, limit = 50) {
    // Set titles start with the date, so descending sort ≈ newest first.
    const data = await api(
      {
        action: "query",
        list: "categorymembers",
        cmtitle: `Category:${dj}`,
        cmnamespace: "0",
        cmsort: "sortkey",
        cmdir: "desc",
        cmlimit: String(limit),
      },
      categoryMembersSchema,
    );
    return (data?.query.categorymembers ?? []).map((m) => toSummary(m.pageid, m.title));
  },

  async getSet(sourceId): Promise<SetDetail | null> {
    const data = await api(
      { action: "parse", pageid: sourceId, prop: "wikitext|categories" },
      parseSchema,
    );
    if (!data) return null;
    const { title, pageid, wikitext, categories } = data.parse;
    return {
      ...toSummary(pageid, title),
      ...categoriesToMeta(categories.map((c) => c.category)),
      tracks: parseTracklist(wikitext),
    };
  },
};
