import type { ParsedTrack, SetSummary } from "../types";

export const MIXESDB_BASE = "https://www.mixesdb.com";

const GENRES = new Set([
  "Acid House",
  "Afro House",
  "Ambient",
  "Bass",
  "Breakbeat",
  "Deep House",
  "Disco",
  "Drum & Bass",
  "Dubstep",
  "Electro",
  "Electronica",
  "Hard Techno",
  "House",
  "Melodic Techno",
  "Minimal",
  "Nu Disco",
  "Progressive House",
  "Progressive Trance",
  "Tech House",
  "Techno",
  "Trance",
  "UK Garage",
]);

const MIX_WORDS =
  /\b(re-?mix|mix|edit|dub|version|rework|re-?rub|bootleg|vip|instrumental|rmx|flip|refix|reprise)\b/i;

/** "[04]" → 240, "[087:24]" → 5244, "[1:02:03]" → 3723, "[050:??]" → 3000. */
export function parseCue(raw: string): number | null {
  const parts = raw.split(":").map((p) => p.trim());
  if (!/^\d+$/.test(parts[0])) return null;
  const nums = parts.map((p) => (/^\d+$/.test(p) ? Number(p) : 0));
  if (nums.length === 1) return nums[0] * 60;
  if (nums.length === 2) return nums[0] * 60 + nums[1];
  return nums[0] * 3600 + nums[1] * 60 + nums[2];
}

/** Turns wiki markup into the plain text a reader would see. */
export function stripWikiMarkup(s: string): string {
  return s
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1") // [[Page|text]] → text
    .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, "$1") // [url text] → text
    .replace(/'{2,}/g, "") // ''italic'' / '''bold'''
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTrailingLabel(s: string): {
  rest: string;
  label: string | null;
  catalogNo: string | null;
} {
  const m = s.match(/^(.*?)\s*\[([^\]]+)\]$/);
  if (!m) return { rest: s, label: null, catalogNo: null };
  const [label, ...cat] = m[2].split(" - ");
  return { rest: m[1], label: label.trim() || null, catalogNo: cat.join(" - ").trim() || null };
}

function splitMixName(title: string): { title: string; mixName: string | null } {
  const m = title.match(/^(.*\S)\s*\(([^()]+)\)$/);
  if (!m || !MIX_WORDS.test(m[2])) return { title, mixName: null };
  return { title: m[1], mixName: m[2] };
}

export function parseTrackLine(
  line: string,
  position: number,
  section: string | null,
): ParsedTrack {
  let body = stripWikiMarkup(line.replace(/^#\s*/, ""));
  let cueSec: number | null = null;

  const cue = body.match(/^\[([\d?:\s]+)\]\s*/);
  if (cue) {
    cueSec = parseCue(cue[1]);
    body = body.slice(cue[0].length);
  }

  let isMashupPart = false;
  const mash = body.match(/^(\+|w\/)\s*/i);
  if (mash) {
    isMashupPart = true;
    body = body.slice(mash[0].length);
  }

  const base = {
    position,
    section,
    cueSec,
    isMashupPart,
    rawLine: line,
    artist: null,
    title: null,
    mixName: null,
    label: null,
    catalogNo: null,
  };

  if (body === "" || /^\?+$/.test(body) || /^ID\s+-\s+ID$/i.test(body)) {
    return { ...base, kind: "unknown", isUnreleased: /ID/i.test(body) };
  }

  const { rest, label, catalogNo } = splitTrailingLabel(body);
  const dash = rest.indexOf(" - ");
  if (dash === -1) {
    return { ...base, kind: "note", label, catalogNo, title: rest, isUnreleased: false };
  }

  const artist = rest.slice(0, dash).trim();
  const split = splitMixName(rest.slice(dash + 3).trim());
  const isUnreleased =
    /^ID$/i.test(artist) ||
    /^ID$/i.test(split.title) ||
    /^ID\b/.test(split.mixName ?? "") ||
    /\b(unreleased|white label|dubplate)\b/i.test(label ?? "");

  return {
    ...base,
    kind: "track",
    artist,
    title: split.title,
    mixName: split.mixName,
    label,
    catalogNo,
    isUnreleased,
  };
}

/** Extracts every "# ..." line under "== Tracklist ==", tracking ";Section" headings. */
export function parseTracklist(wikitext: string): ParsedTrack[] {
  const start = wikitext.search(/^==\s*Tracklist\s*==\s*$/m);
  if (start === -1) return [];
  const after = wikitext.slice(start).split("\n").slice(1);

  const tracks: ParsedTrack[] = [];
  let section: string | null = null;
  for (const raw of after) {
    const line = raw.trim();
    if (/^==[^=]/.test(line)) break; // next top-level section
    if (line.startsWith(";")) section = stripWikiMarkup(line.slice(1)) || null;
    else if (line.startsWith("#")) tracks.push(parseTrackLine(line, tracks.length + 1, section));
  }
  return tracks;
}

/**
 * MixesDB titles look like:
 *   "2021-03-06 - Solomun - Sputnik Club"
 *   "2016-07-24 - Solomun @ Solomun +1, Pacha, Ibiza (Essential Mix, 2016-07-30)"
 *   "2026-08-08 - Moguai, Robin Schulz, LOVRA - 1LIVE DJ Session"
 */
export function parseSetTitle(
  title: string,
): Pick<SetSummary, "djs" | "venue" | "event" | "playedAt"> {
  const m = title.match(/^(\d{4}(?:-\d{2}(?:-\d{2})?)?|\d{3}X|\d{2}XX)\s+-\s+(.*)$/);
  if (!m) return { djs: [], venue: null, event: null, playedAt: null };
  const playedAt = m[1];
  const rest = m[2];

  const at = rest.indexOf(" @ ");
  const dash = rest.indexOf(" - ");
  const djEnd = [at, dash].filter((i) => i !== -1).sort((a, b) => a - b)[0] ?? rest.length;
  const djs = rest
    .slice(0, djEnd)
    .split(/,\s*|\s+&\s+|\s+b2b\s+/i)
    .map((s) => s.trim())
    .filter((s) => s && s !== "VA");

  let venue: string | null = null;
  let event: string | null = null;
  if (djEnd === at) {
    const afterAt = rest.slice(at + 3);
    const venueEnd = afterAt.search(/\s+-\s+|\s+\(/);
    venue = (venueEnd === -1 ? afterAt : afterAt.slice(0, venueEnd)).trim();
    event =
      venueEnd === -1
        ? null
        : afterAt
            .slice(venueEnd)
            .replace(/^\s*-\s*/, "")
            .trim()
            .replace(/^\((.*)\)$/, "$1") || null;
  } else if (djEnd === dash) {
    event = rest.slice(dash + 3).trim() || null;
  }

  return { djs, venue, event, playedAt };
}

export function categoriesToMeta(categories: string[]) {
  const names = categories.map((c) => c.replace(/_/g, " "));
  return {
    genres: names.filter((n) => GENRES.has(n)),
    isComplete: names.includes("Tracklist: complete"),
  };
}

export function pageUrl(title: string): string {
  return `${MIXESDB_BASE}/w/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}
