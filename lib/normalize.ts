/** Lowercase, strip accents and punctuation, collapse whitespace — for dedupe keys and matching. */
export function normalize(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function trackKey(artist: string, title: string, mixName: string | null): string {
  return [artist, title, mixName ?? ""].map(normalize).join("|");
}
