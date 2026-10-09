import { normalize } from "@/lib/normalize";

export interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string; width?: number | null }[] };
  duration_ms?: number;
}

export interface MatchInput {
  artist: string;
  title: string;
  mixName: string | null;
}

export interface ScoredCandidate {
  track: SpotifyTrack;
  score: number;
  titleScore: number;
  artistScore: number;
  versionScore: number;
}

export const MATCH_THRESHOLD = 0.75;

// Words that describe a version without naming who made it.
const GENERIC = new Set(
  "original extended club radio edit mix version vocal instrumental dub remaster remastered single album video short long the a".split(
    " ",
  ),
);
const REMIX_WORDS = /\b(remix|rework|re-?rub|bootleg|refix|flip|vip|edit|dub)\b/i;

const ARTIST_SPLIT =
  /\s*(?:,|&|\bfeat\.?|\bft\.?|\bfeaturing\b|\bvs\.?|\bx\b|\band\b|\bpres\.?)\s*/i;

export function splitArtists(s: string): string[] {
  return s
    .split(ARTIST_SPLIT)
    .map(normalize)
    .filter((a) => a && a !== "va");
}

/** "Tuk Tuk - feat. ÄTNA - Jackmaster & Skream Remix" → { base: "Tuk Tuk", version: "Jackmaster & Skream Remix", featured: ["ätna"] } */
export function parseSpotifyName(name: string) {
  const featured: string[] = [];
  let s = name.replace(/[([]\s*(?:feat\.?|ft\.?|with)\s+([^)\]]+)[)\]]/gi, (_, a: string) => {
    featured.push(...splitArtists(a));
    return "";
  });
  const parts = s.split(/\s+-\s+/);
  const base = parts.shift() ?? "";
  const versions: string[] = [];
  for (const p of parts) {
    const feat = p.match(/^(?:feat\.?|ft\.?|with)\s+(.+)$/i);
    if (feat) featured.push(...splitArtists(feat[1]));
    else versions.push(p);
  }
  // Trailing "(Carl Craig Remix)" in the base title is a version too.
  s = base.replace(/\s*\(([^()]+)\)\s*$/, (m, inner: string) => {
    if (/\b(mix|remix|edit|version|dub|rework)\b/i.test(inner)) {
      versions.push(inner);
      return "";
    }
    return m;
  });
  return { base: s.trim(), version: versions.join(" ").trim() || null, featured };
}

const tokens = (s: string | null) => (s ? normalize(s).split(" ").filter(Boolean) : []);
const nameTokens = (s: string | null) =>
  tokens(s).filter((t) => !GENERIC.has(t) && !REMIX_WORDS.test(t));

function bigrams(s: string) {
  const out = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++)
    out.set(s.slice(i, i + 2), (out.get(s.slice(i, i + 2)) ?? 0) + 1);
  return out;
}

/** Sørensen–Dice similarity on character bigrams (0..1). */
export function similarity(a: string, b: string): number {
  const x = normalize(a).replace(/ /g, "");
  const y = normalize(b).replace(/ /g, "");
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;
  const bx = bigrams(x);
  let overlap = 0;
  for (const [g, n] of bigrams(y)) {
    const m = bx.get(g) ?? 0;
    overlap += Math.min(m, n);
  }
  return (2 * overlap) / (x.length - 1 + (y.length - 1));
}

function versionScore(ourMix: string | null, theirVersion: string | null): number {
  const ourNames = nameTokens(ourMix);
  const theirNames = nameTokens(theirVersion);
  if (ourNames.length > 0) {
    // A named remix must be that remix.
    const hit = ourNames.filter((t) => theirNames.includes(t)).length / ourNames.length;
    return hit >= 0.5 ? hit : 0;
  }
  // We want the original (or a generic extended/club/edit): penalize someone else's remix.
  if (theirNames.length > 0 && REMIX_WORDS.test(theirVersion ?? "")) return 0.3;
  const ours = tokens(ourMix);
  const theirs = tokens(theirVersion);
  if (ours.length === 0 && theirs.length === 0) return 1;
  const shared = ours.filter((t) => theirs.includes(t)).length;
  return 0.7 + (0.3 * shared) / Math.max(ours.length, theirs.length, 1);
}

export function scoreCandidate(input: MatchInput, track: SpotifyTrack): ScoredCandidate {
  const parsed = parseSpotifyName(track.name);
  const ours = splitArtists(input.artist);
  const theirs = new Set([
    ...track.artists.flatMap((a) => splitArtists(a.name)),
    ...parsed.featured,
  ]);
  const artistScore = ours.length ? ours.filter((a) => theirs.has(a)).length / ours.length : 0;
  const titleScore = similarity(input.title, parsed.base);
  const vScore = versionScore(input.mixName, parsed.version);
  return {
    track,
    titleScore,
    artistScore,
    versionScore: vScore,
    score: 0.45 * titleScore + 0.35 * artistScore + 0.2 * vScore,
  };
}

export function isAcceptable(c: ScoredCandidate): boolean {
  return (
    c.titleScore >= 0.8 && c.artistScore >= 0.5 && c.versionScore > 0 && c.score >= MATCH_THRESHOLD
  );
}

/** Ranks candidates (stable, so Spotify's relevance order breaks ties). */
export function rankCandidates(input: MatchInput, tracks: SpotifyTrack[]): ScoredCandidate[] {
  const seen = new Set<string>();
  return tracks
    .filter((t) => !seen.has(t.id) && seen.add(t.id))
    .map((t) => scoreCandidate(input, t))
    .sort((a, b) => b.score - a.score);
}

export function bestMatch(input: MatchInput, tracks: SpotifyTrack[]): ScoredCandidate | null {
  const [top] = rankCandidates(input, tracks);
  return top && isAcceptable(top) ? top : null;
}

/** Strict field query first, then a loose keyword query as fallback. */
export function buildQueries(input: MatchInput): string[] {
  const primary = input.artist.split(ARTIST_SPLIT)[0].trim();
  const clean = (s: string) => s.replace(/"/g, "");
  const remixer = nameTokens(input.mixName).join(" ");
  return [
    `track:"${clean(input.title)}" artist:"${clean(primary)}"`,
    [primary, input.title, remixer].filter(Boolean).map(clean).join(" "),
  ];
}
