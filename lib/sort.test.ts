import { describe, expect, it } from "vitest";
import { dateKey, parseSort, sortDate, sortSets } from "./sort";
import type { SetSummary } from "./sources/types";

const set = (sourceId: string, playedAt: string | null): SetSummary => ({
  source: "mixesdb",
  sourceId,
  title: sourceId,
  djs: [],
  venue: null,
  event: null,
  playedAt,
  sourceUrl: "",
});

describe("dateKey", () => {
  it.each([
    ["2021-03-06", "2021-03-06"],
    ["2013", "2013-00-00"],
    ["2013-04", "2013-04-00"],
    ["201X", "2010-00-00"],
    ["20XX", "2000-00-00"],
    [null, null],
    ["unknown", null],
  ])("%s → %s", (input, expected) => expect(dateKey(input)).toBe(expected));
});

describe("sortDate", () => {
  it("refines a partial date with a matching full date from the title", () => {
    const title = "201X - Solomun @ Ego, Hamburg - RA Podcast (RA.360, 2013-04-22)";
    expect(sortDate({ playedAt: "201X", title })).toBe("2013-04-22");
    expect(sortDate({ playedAt: "2013", title })).toBe("2013-04-22");
  });

  it("ignores title dates that contradict the known part", () => {
    const title = "2009 - Solomun - Goa Cast 4 (reissued 2015-01-01)";
    expect(sortDate({ playedAt: "2009", title })).toBe("2009-00-00");
  });

  it("keeps full dates as they are", () => {
    expect(sortDate({ playedAt: "2021-03-06", title: "x 2020-01-01" })).toBe("2021-03-06");
  });
});

describe("sortSets", () => {
  const sets = [
    set("a", "2013"),
    set("b", "2021-03-06"),
    set("c", null),
    set("d", "201X"),
    set("e", "2021-03-06"),
  ];

  it("sorts newest first, partial dates by their known part, unknown last", () => {
    expect(sortSets(sets, "newest").map((s) => s.sourceId)).toEqual(["b", "e", "a", "d", "c"]);
  });

  it("sorts oldest first, keeping unknown dates last", () => {
    expect(sortSets(sets, "oldest").map((s) => s.sourceId)).toEqual(["d", "a", "b", "e", "c"]);
  });

  it("keeps source order for relevance and does not mutate input", () => {
    expect(sortSets(sets, "relevance")).toBe(sets);
    sortSets(sets, "newest");
    expect(sets.map((s) => s.sourceId)).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("parseSort", () => {
  it("defaults to newest for missing or unknown values", () => {
    expect(parseSort(undefined)).toBe("newest");
    expect(parseSort("bogus")).toBe("newest");
    expect(parseSort(["oldest", "x"])).toBe("oldest");
  });
});
