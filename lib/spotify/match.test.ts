import { describe, expect, it } from "vitest";
import {
  bestMatch,
  buildQueries,
  parseSpotifyName,
  rankCandidates,
  similarity,
  splitArtists,
  type SpotifyTrack,
} from "./match";
import tukTuk from "./__fixtures__/search-solomun-tuk-tuk.json";
import cassini from "./__fixtures__/search-allan-shotter-cassini-solomun.json";
import safetyDance from "./__fixtures__/search-men-without-hats-safety-dance.json";
import bessabia from "./__fixtures__/search-angelov-bessabia.json";
import returnStrict from "./__fixtures__/search-vittoria-feet-return-carl-craig.json";
import returnLoose from "./__fixtures__/search-loose-vittoria-feet-return.json";
import boyHarsher from "./__fixtures__/search-loose-boy-harsher-la.json";

const items = (f: { items: unknown[] }) => f.items as SpotifyTrack[];

describe("parseSpotifyName", () => {
  it("separates featured artists and versions", () => {
    expect(parseSpotifyName("Tuk Tuk - feat. ÄTNA - Jackmaster & Skream Remix")).toEqual({
      base: "Tuk Tuk",
      version: "Jackmaster & Skream Remix",
      featured: ["atna"],
    });
    expect(parseSpotifyName("Tuk Tuk (feat. ÄTNA)")).toEqual({
      base: "Tuk Tuk",
      version: null,
      featured: ["atna"],
    });
    expect(parseSpotifyName("Return (Carl Craig Remix)").version).toBe("Carl Craig Remix");
  });
});

describe("splitArtists / similarity", () => {
  it("splits common collaboration separators", () => {
    expect(splitArtists("Solomun Feat. ÄTNA")).toEqual(["solomun", "atna"]);
    expect(splitArtists("Patrick Podage & Nikola Kotevski")).toEqual([
      "patrick podage",
      "nikola kotevski",
    ]);
  });
  it("is 1 for equal strings after normalizing", () => {
    expect(similarity("Don't Worry Baby", "Dont Worry Baby")).toBe(1);
    expect(similarity("LA", "Bleed")).toBe(0);
  });
});

describe("bestMatch (recorded Spotify responses)", () => {
  it("prefers the original over a remix when no remix is listed", () => {
    const m = bestMatch(
      { artist: "Solomun Feat. ÄTNA", title: "Tuk Tuk", mixName: "Edit" },
      items(tukTuk),
    );
    expect(m?.track.name).not.toMatch(/Remix/);
    expect(m?.artistScore).toBe(1);
  });

  it("requires the named remixer", () => {
    const m = bestMatch(
      { artist: "Allan Shotter", title: "Cassini", mixName: "Solomun Remix" },
      items(cassini),
    );
    expect(m?.track.name).toBe("Cassini - Solomun Remix");
  });

  it("prefers the closest generic version", () => {
    const m = bestMatch(
      { artist: "Men Without Hats", title: "The Safety Dance", mixName: "Extended Club Mix" },
      items(safetyDance),
    );
    expect(m?.track.name).toBe("The Safety Dance - Club Mix");
  });

  it("matches a simple exact track", () => {
    expect(
      bestMatch({ artist: "Angelov", title: "Bessabia", mixName: null }, items(bessabia))?.track
        .name,
    ).toBe("Bessabia");
    expect(
      bestMatch({ artist: "Boy Harsher", title: "LA", mixName: null }, items(boyHarsher))?.track
        .name,
    ).toBe("LA");
  });

  it("rejects unrelated loose results instead of guessing", () => {
    const input = { artist: "Vittoria Feet", title: "Return", mixName: "Carl Craig Remix" };
    expect(bestMatch(input, items(returnStrict))).toBeNull();
    expect(bestMatch(input, items(returnLoose))).toBeNull();
  });

  it("dedupes and ranks all candidates for the picker", () => {
    const ranked = rankCandidates(
      { artist: "Allan Shotter", title: "Cassini", mixName: "Solomun Remix" },
      [...items(cassini), ...items(cassini)],
    );
    expect(ranked).toHaveLength(new Set(items(cassini).map((t) => t.id)).size);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked.at(-1)!.score);
  });
});

describe("buildQueries", () => {
  it("builds a strict and a loose query", () => {
    expect(
      buildQueries({ artist: "Vittoria Feet", title: "Return", mixName: "Carl Craig Remix" }),
    ).toEqual(['track:"Return" artist:"Vittoria Feet"', "Vittoria Feet Return carl craig"]);
  });
});
