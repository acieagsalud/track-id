import { describe, expect, it } from "vitest";
import {
  categoriesToMeta,
  parseCue,
  parseSetTitle,
  parseTrackLine,
  parseTracklist,
  stripWikiMarkup,
} from "./parse";
import sputnik from "./__fixtures__/page-264926.json";
import raPodcast from "./__fixtures__/page-143558.json";
import essentialMix from "./__fixtures__/page-113019.json";
import djSession from "./__fixtures__/page-770688.json";

describe("parseCue", () => {
  it.each([
    ["00", 0],
    ["04", 240],
    ["087:24", 5244],
    ["1:02:03", 3723],
    ["050:??", 3000],
    ["??", null],
  ])("%s → %s", (raw, expected) => expect(parseCue(raw)).toBe(expected));
});

describe("stripWikiMarkup", () => {
  it("removes italics, links and comments", () => {
    expect(stripWikiMarkup("''&ME - Woods [[Keinemusik|KM]]'' <!-- x -->")).toBe("&ME - Woods KM");
  });
});

describe("parseTrackLine", () => {
  it("splits artist, title, remix, label and catalog", () => {
    expect(
      parseTrackLine(
        "# [10] Clark & Pudell - Zashu (Viper Strike Beats & Bass Edit) [Pole Position - PPR Z041]",
        3,
        null,
      ),
    ).toMatchObject({
      position: 3,
      cueSec: 600,
      kind: "track",
      artist: "Clark & Pudell",
      title: "Zashu",
      mixName: "Viper Strike Beats & Bass Edit",
      label: "Pole Position",
      catalogNo: "PPR Z041",
      isUnreleased: false,
      isMashupPart: false,
    });
  });

  it("keeps non-remix parentheses in the title", () => {
    const t = parseTrackLine("# Kelley Polar - Entropy Reigns (In The Celestial City)", 1, null);
    expect(t.title).toBe("Entropy Reigns (In The Celestial City)");
    expect(t.mixName).toBeNull();
  });

  it("takes only the last parenthetical as the mix name", () => {
    const t = parseTrackLine(
      "# Swedish House Mafia - One (Your Name) (Darren After Edit) [Free]",
      1,
      null,
    );
    expect(t).toMatchObject({
      title: "One (Your Name)",
      mixName: "Darren After Edit",
      label: "Free",
    });
  });

  it("treats '?' and 'ID - ID' as unknown", () => {
    expect(parseTrackLine("# [053:40] ?", 1, null)).toMatchObject({
      kind: "unknown",
      cueSec: 3220,
    });
    expect(parseTrackLine("# ID - ID", 1, null)).toMatchObject({
      kind: "unknown",
      isUnreleased: true,
    });
  });

  it("flags unreleased IDs", () => {
    expect(parseTrackLine("# Solomun - ID", 1, null).isUnreleased).toBe(true);
    expect(parseTrackLine("# ''&ME - Woods (ID Remix) [Keinemusik]''", 1, null)).toMatchObject({
      artist: "&ME",
      mixName: "ID Remix",
      isUnreleased: true,
    });
  });

  it("marks layered tracks", () => {
    expect(
      parseTrackLine("# [087:24] + Klingande - Only God Can Save Our Souls", 1, null),
    ).toMatchObject({ isMashupPart: true, artist: "Klingande" });
    expect(parseTrackLine("# w/ Kate Bush - Army Dreamers", 1, null).isMashupPart).toBe(true);
  });

  it("treats lines without 'Artist - Title' as notes", () => {
    expect(parseTrackLine("# [000:00] Intro", 1, null)).toMatchObject({
      kind: "note",
      title: "Intro",
    });
  });
});

describe("parseTracklist (fixtures)", () => {
  it("parses a complete tracklist without cues", () => {
    const tracks = parseTracklist(sputnik.parse.wikitext);
    expect(tracks).toHaveLength(12);
    expect(tracks[0]).toMatchObject({
      artist: "Solomun Feat. ÄTNA",
      title: "Tuk Tuk",
      mixName: "Edit",
      label: "NINL",
      cueSec: null,
    });
    expect(tracks.every((t) => t.kind === "track")).toBe(true);
  });

  it("parses minute cues", () => {
    const tracks = parseTracklist(raPodcast.parse.wikitext);
    expect(tracks).toHaveLength(16);
    expect(tracks.at(-1)).toMatchObject({ cueSec: 71 * 60, artist: "Kate Bush", label: "EMI" });
  });

  it("parses min:sec cues, unknowns and layered tracks", () => {
    const tracks = parseTracklist(essentialMix.parse.wikitext);
    expect(tracks).toHaveLength(22);
    expect(tracks.filter((t) => t.kind === "unknown")).toHaveLength(6);
    expect(tracks.filter((t) => t.isMashupPart)).toHaveLength(1);
    expect(tracks[14]).toMatchObject({ title: "Third Knife", label: "20:20 Vision", cueSec: 4647 });
  });

  it("tracks ';Section' headings for multi-DJ pages", () => {
    const tracks = parseTracklist(djSession.parse.wikitext);
    const sections = [...new Set(tracks.map((t) => t.section))];
    expect(sections).toEqual([
      "Moguai = 2026-08-06 - Moguai - PUNX Up The Volume 692",
      "Robin Schulz @ PACHA, Ibiza",
      "LOVRA",
    ]);
    expect(tracks.at(-1)?.position).toBe(tracks.length);
  });

  it("returns [] when there is no tracklist", () => {
    expect(parseTracklist("== File details ==\nnothing")).toEqual([]);
  });
});

describe("parseSetTitle", () => {
  it("parses 'date - DJ - event'", () => {
    expect(parseSetTitle("2021-03-06 - Solomun - Sputnik Club")).toEqual({
      djs: ["Solomun"],
      venue: null,
      event: "Sputnik Club",
      playedAt: "2021-03-06",
    });
  });

  it("parses 'date - DJ @ venue (event)'", () => {
    expect(
      parseSetTitle("2016-07-24 - Solomun @ Solomun +1, Pacha, Ibiza (Essential Mix, 2016-07-30)"),
    ).toEqual({
      djs: ["Solomun"],
      venue: "Solomun +1, Pacha, Ibiza",
      event: "Essential Mix, 2016-07-30",
      playedAt: "2016-07-24",
    });
  });

  it("parses partial dates and venue + event", () => {
    expect(
      parseSetTitle("201X - Solomun @ Ego, Hamburg - RA Podcast (RA.360, 2013-04-22)"),
    ).toEqual({
      djs: ["Solomun"],
      venue: "Ego, Hamburg",
      event: "RA Podcast (RA.360, 2013-04-22)",
      playedAt: "201X",
    });
  });

  it("splits multiple DJs", () => {
    expect(
      parseSetTitle("2026-08-08 - Moguai, Robin Schulz, LOVRA - 1LIVE DJ Session").djs,
    ).toEqual(["Moguai", "Robin Schulz", "LOVRA"]);
  });

  it("splits b2b DJs", () => {
    expect(
      parseSetTitle("2026-07-05 - Skrillex b2b Solomun @ Solomun +1, Pacha, Ibiza"),
    ).toMatchObject({
      djs: ["Skrillex", "Solomun"],
      venue: "Solomun +1, Pacha, Ibiza",
      event: null,
    });
  });
});

describe("categoriesToMeta", () => {
  it("extracts genres and completeness", () => {
    expect(categoriesToMeta(sputnik.parse.categories.map((c) => c.category))).toEqual({
      genres: ["House", "Progressive House"],
      isComplete: true,
    });
    expect(categoriesToMeta(raPodcast.parse.categories.map((c) => c.category)).isComplete).toBe(
      false,
    );
  });
});
