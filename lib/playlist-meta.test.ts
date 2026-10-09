import { describe, expect, it } from "vitest";
import { chunk, orderedUris, playlistDescription, playlistName } from "./playlist-meta";
import type { SetSummary } from "./sources/types";

const set = (over: Partial<SetSummary>): SetSummary => ({
  source: "mixesdb",
  sourceId: "1",
  title: "2021-03-06 - Solomun - Sputnik Club",
  djs: ["Solomun"],
  venue: null,
  event: "Sputnik Club",
  playedAt: "2021-03-06",
  sourceUrl: "https://www.mixesdb.com/w/x",
  ...over,
});

describe("playlistName", () => {
  it("uses DJ, venue or event, and date", () => {
    expect(playlistName(set({}))).toBe("Solomun @ Sputnik Club (2021-03-06)");
    expect(playlistName(set({ djs: ["Skrillex", "Solomun"], venue: "Pacha, Ibiza" }))).toBe(
      "Skrillex & Solomun @ Pacha, Ibiza (2021-03-06)",
    );
  });

  it("falls back to the source title when no DJ is known", () => {
    expect(playlistName(set({ djs: [] }))).toBe("2021-03-06 - Solomun - Sputnik Club");
  });

  it("stays within Spotify's 100 character limit", () => {
    const name = playlistName(set({ djs: Array(20).fill("Some Long DJ Name") }));
    expect(name.length).toBe(100);
    expect(name.endsWith("…")).toBe(true);
  });
});

describe("playlistDescription", () => {
  it("credits the source and mentions skipped tracks", () => {
    expect(playlistDescription(set({}), 2)).toBe(
      "2021-03-06 - Solomun - Sputnik Club · 2 tracks not on Spotify · Tracklist: https://www.mixesdb.com/w/x · Made with track-id",
    );
    expect(playlistDescription(set({}), 0)).not.toContain("not on Spotify");
  });
});

describe("orderedUris", () => {
  it("keeps set order, skips missing and dedupes repeats", () => {
    expect(
      orderedUris([3, null, 1, 2, 3], { 1: "spotify:track:a", 2: null, 3: "spotify:track:c" }),
    ).toEqual(["spotify:track:c", "spotify:track:a"]);
  });
});

describe("chunk", () => {
  it("splits into Spotify's 100-item batches", () => {
    expect(
      chunk(
        Array.from({ length: 250 }, (_, i) => i),
        100,
      ).map((c) => c.length),
    ).toEqual([100, 100, 50]);
  });
});
